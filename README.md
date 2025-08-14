# Amper Tracker API

ESP32'den gelen amper tüketim verilerini toplayan ve mobil uygulamaya sunan REST API.

## 🚀 Özellikler

- **ESP32 Entegrasyonu**: POST endpoint ile amper verisi alma
- **Mobil Uygulama Desteği**: React Native için optimize edilmiş endpoints
- **Gerçek Zamanlı İstatistikler**: Progress bar için yüzde hesaplama
- **Son 24 Saat Verisi**: Mobil uygulama tablosu için
- **MongoDB Atlas**: Cloud veritabanı entegrasyonu
- **Güvenlik**: Rate limiting, CORS, input validation
- **Modern JavaScript**: ES6+ modules, async/await

## 📋 Gereksinimler

- Node.js >= 18.0.0
- MongoDB Atlas hesabı
- npm veya yarn

## 🛠️ Kurulum

### 1. Projeyi Klonla

```bash
git clone <repository-url>
cd amper-tracker-api
```

### 2. Bağımlılıkları Yükle

```bash
npm install
```

### 3. Environment Variables

`.env` dosyasını oluştur ve `env.example`'daki değerleri kopyala:

```bash
cp env.example .env
```

`.env` dosyasını düzenle:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
PORT=3000
NODE_ENV=development
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. MongoDB Atlas Kurulumu

1. [MongoDB Atlas](https://www.mongodb.com/atlas) hesabı oluştur
2. M0 Free cluster oluştur
3. Database user oluştur (username/password)
4. Network Access'te `0.0.0.0/0` ekle
5. Database: `amper-tracker-db`, Collection: `amper_readings`
6. Connection string'i `.env` dosyasına ekle

### 5. Uygulamayı Başlat

```bash
# Development
npm run dev

# Production
npm start
```

## 📡 API Endpoints

### ESP32 için

#### POST /api/data

Amper verisi gönder

**Request Body:**

```json
{
  "username": "user1",
  "amper": 1.2,
  "timestamp": "2025-07-13T14:30:00Z"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Amper reading saved successfully",
  "data": {
    "id": "64a1b2c3d4e5f6789012345",
    "username": "user1",
    "amper": 1.2,
    "timestamp": "2025-07-13T14:30:00.000Z"
  }
}
```

### Mobil Uygulama için

#### GET /api/user/:username/stats

Kullanıcı istatistikleri (progress bar için)

**Response:**

```json
{
  "success": true,
  "data": {
    "totalReadings": 150,
    "highAmpCount": 90,
    "lowAmpCount": 60,
    "percentage": 60
  }
}
```

#### GET /api/user/:username/recent

Son 24 saat verisi (tablo için)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-07-13T14:30:00.000Z",
      "amper": 1.2
    },
    {
      "timestamp": "2025-07-13T14:25:00.000Z",
      "amper": 0.8
    }
  ]
}
```

### Utility Endpoints

#### GET /api/health

API sağlık kontrolü

#### GET /api/user/:username/all (Development)

Tüm kullanıcı verileri (sadece development modunda)

## 🔧 ESP32 Örnek Kodu

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* apiUrl = "https://your-api-url.com/api/data";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    // Amper değerini oku (örnek)
    float amperValue = readAmperSensor();

    // JSON oluştur
    StaticJsonDocument<200> doc;
    doc["username"] = "user1";
    doc["amper"] = amperValue;
    doc["timestamp"] = getCurrentTimestamp();

    String jsonString;
    serializeJson(doc, jsonString);

    // HTTP POST gönder
    HTTPClient http;
    http.begin(apiUrl);
    http.addHeader("Content-Type", "application/json");

    int httpResponseCode = http.POST(jsonString);

    if (httpResponseCode > 0) {
      Serial.println("Data sent successfully");
    } else {
      Serial.println("Error sending data");
    }

    http.end();
  }

  delay(60000); // 1 dakika bekle
}

float readAmperSensor() {
  // Amper sensörü okuma kodu buraya
  return random(50, 150) / 100.0; // Örnek değer
}

String getCurrentTimestamp() {
  // Timestamp oluşturma kodu
  return "2025-07-13T14:30:00Z";
}
```

## 🚀 Deployment (Render)

1. GitHub'a push et
2. [Render](https://render.com) hesabı oluştur
3. "New Web Service" seç
4. GitHub repo'yu bağla
5. Environment variables ekle:
   - `MONGODB_URI`
   - `NODE_ENV=production`
6. Deploy et

## 📊 Veritabanı Şeması

```javascript
// Collection: amper_readings
{
  _id: ObjectId,
  username: String,        // Kullanıcı adı
  timestamp: Date,         // Veri zamanı
  amper: Number,          // Amper değeri
  createdAt: Date,        // Oluşturulma zamanı
}
```

**Index:**

```javascript
{ "username": 1, "timestamp": -1 }
```

## 🔒 Güvenlik

- **Rate Limiting**: 100 request/15 dakika
- **Input Validation**: Tüm girişler validate edilir
- **CORS**: React Native için yapılandırılmış
- **Helmet**: Güvenlik headers
- **Error Handling**: Detaylı hata yönetimi

## 🧪 Test

```bash
# Health check
curl http://localhost:3000/api/health

# Test data gönder
curl -X POST http://localhost:3000/api/data \
  -H "Content-Type: application/json" \
  -d '{"username":"test","amper":1.5}'

# Stats al
curl http://localhost:3000/api/user/test/stats

# Recent data al
curl http://localhost:3000/api/user/test/recent
```

## 🆕 Modern JavaScript Özellikleri

- **ES6 Modules**: `import`/`export` syntax
- **Async/Await**: Modern promise handling
- **Arrow Functions**: Concise function syntax
- **Template Literals**: String interpolation
- **Destructuring**: Object/array destructuring
- **Optional Chaining**: Safe property access

## 📝 Lisans

MIT License

## 🤝 Katkıda Bulunma

1. Fork et
2. Feature branch oluştur
3. Commit et
4. Push et
5. Pull Request oluştur
