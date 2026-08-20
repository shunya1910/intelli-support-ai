# 🤖 IntelliSupport AI 

IntelliSupport AI is an **Event-Driven, AI-powered IT Support Platform**. 
It handles user support tickets instantly via a React frontend, while asynchronously processing complex IT resolutions in the background using Google Gemini, Spring Boot, and Kafka.

## 🚀 Tech Stack
* **Frontend:** React, Vite, CSS, WebSockets (SockJS/STOMP)
* **Backend:** Java 17, Spring Boot 3
* **Databases:** PostgreSQL (Storage) & Redis (Caching)
* **Event Broker:** Apache Kafka (Asynchronous messaging)
* **AI:** Google Gemini 3.5 Flash Lite API

## ⚙️ How to Run Locally

### 1. Development Mode (Hot Reloading)
To run the databases in Docker while keeping the code running natively on your machine:
```bash
# Start the Infrastructure
docker-compose up -d postgres redis zookeeper kafka

# Start the Backend (in a new terminal)
cd backend
./mvnw spring-boot:run

# Start the Frontend (in a new terminal)
cd frontend
npm run dev
```

### 2. Production Mode (Full Dockerization)
To test the finalized, sealed production containers locally:
```bash
docker-compose up -d --build
```
Then navigate to `http://localhost:5173` in your browser.

## 🛠️ Architecture Highlights
* **Write-Through Caching:** Data is safely written to Postgres before being cached in Redis to prevent data poisoning.
* **Dead Letter Queue (DLQ):** Failed AI API requests are automatically retried 3 times before being safely routed to a DLT topic to prevent data loss.
* **Real-Time WebSockets:** The UI instantly updates via a secure WebSocket connection the millisecond the AI finishes processing a ticket in the background.
* **Multi-Stage Builds:** The application is packaged using tiny Alpine Linux runner images for maximum security and minimal footprint.
