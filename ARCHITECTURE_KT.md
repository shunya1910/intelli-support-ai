# IntelliSupport AI: Technical Knowledge Transfer (KT) Document

**Target Audience:** New Joiners, Full-Stack Engineers, DevOps Engineers
**Purpose:** This document serves as the official Knowledge Transfer (KT) guide for the IntelliSupport AI platform. It provides a deep, technical breakdown of the system architecture, data flow, and design decisions to accelerate developer onboarding.

---

## 1. System Overview & Technology Stack

IntelliSupport AI is an Event-Driven, AI-powered IT Support platform. It is designed to handle user support tickets instantly via a React frontend while asynchronously processing complex AI resolutions in the background using Spring Boot and Kafka.

### Tech Stack:
- **Frontend:** React, Vite, TailwindCSS (for UI components), SockJS & STOMP (WebSockets)
- **Backend:** Java 17+, Spring Boot 3.x, Spring Security (JWT)
- **Primary Database:** PostgreSQL 15 (Relational Data)
- **Caching Layer:** Redis (High-speed key-value store)
- **Event Broker:** Apache Kafka (Asynchronous messaging)
- **AI Engine:** Google Gemini 3.5 Flash Lite REST API

---

## 2. The Architectural Pattern: Event-Driven Design (EDA)

**KT Note - Why Event-Driven?** 
If we made the user wait for the Google Gemini API to respond before saving their ticket, their browser would freeze for 5+ seconds. To ensure a snappy User Experience, we split the flow into two completely separate timelines:
1. **The Synchronous Web Request** (Handles the UI instantly - milliseconds)
2. **The Asynchronous Background Process** (Handles the heavy AI logic - seconds)

---

## 3. Data Flow Part 1: The Synchronous Web Request (Instant)

This process happens in a fraction of a millisecond.

### Step 1: React Frontend Submission (`App.jsx`)
When a user submits a ticket, React packages the payload (Title, Description) into JSON and fires an HTTP `POST` request to `http://localhost:8080/api/tickets`.

### Step 2: The Spring Boot API (`TicketController.java`)
The Tomcat web server receives the request and routes it to the controller. The controller immediately injects a default status of `"OPEN"` and records the current timestamp.

### Step 3: Primary Storage (`TicketRepository.java` -> PostgreSQL)
The controller calls `ticketRepository.save(ticket)`. Spring Data JPA translates this into a SQL `INSERT` statement and physically writes the row to the PostgreSQL database.
*KT Note on Schema:* The `description` field is strictly mapped to Postgres' unbounded `TEXT` datatype (`@Column(columnDefinition = "TEXT")`) to gracefully handle massive multi-paragraph AI responses later in the pipeline.

### Step 4: Smart Caching & Eviction (Redis)
Because the `createTicket` method is annotated with `@CachePut`, Spring Boot intercepts the returned ticket and stores it in **Redis**. It also triggers `@CacheEvict(value = "all_tickets")` to wipe the master list cache.

**KT Note on Write-Through Caching:**
It is important to understand that data is *always* saved to PostgreSQL first before touching Redis. This pattern is called **Write-Through Caching** and is critical for data safety:
- If PostgreSQL crashes or rejects the data, the method throws a SQL exception.
- Because it threw an exception, the Spring Proxy cancels the Redis save entirely.
- This guarantees our Redis cache is never polluted with "fake" data that doesn't exist in Postgres. Postgres is our Source of Truth; Redis is just our high-speed billboard.

### Step 5: Event Publishing (`TicketProducer.java` -> Kafka)
Immediately after saving the ticket to Postgres, the Controller hands the Java `Ticket` object to the Kafka Producer. 
- **Serialization:** Because Kafka cannot read Java code, the Producer uses Jackson to "serialize" (convert) the Java object into a lightweight JSON string.
- **The Topic:** It fires this JSON string into a specific Kafka channel called `ticket-events`. 

**KT Note on Kafka as an "Indestructible Mailbox":**
Why use Kafka instead of just calling a Java method? Kafka provides **Decoupling and Durability**. 
Unlike standard computer memory (RAM) which gets wiped if the server crashes, Kafka physically writes every single event to its hard drive. It acts as an "indestructible mailbox." 
If the AI background workers are currently offline, overwhelmed with 10,000 tickets, or crash unexpectedly, the tickets are not lost! The Controller can simply drop the event in the mailbox and instantly return a success message to the user, knowing Kafka will hold onto the event safely for days until a background worker is ready to process it.

### Step 6: The UI Updates
The Controller is now finished! It returns a `201 Created` response. React takes this and injects it into the UI. The user instantly sees their ticket appear as **OPEN**.

---

## 4. Data Flow Part 2: The Asynchronous Background Process (Delayed)

While the user is looking at their screen, the backend is secretly working.

### Step 7: Event Consumption (`TicketConsumer.java`)
Spring Boot is constantly monitoring the Kafka `ticket-events` topic. The millisecond the Producer drops the ticket into the topic, a background consumer thread grabs it.

### Step 8: Google Gemini LLM Integration (`AiService.java`)
The Consumer takes the ticket and passes it to `AiService`.
- Using Spring's `RestTemplate`, the server crafts a complex JSON payload.
- It fires a live HTTP POST request to Google's **Gemini REST API**, injecting the secret API key.
- The LLM streams back a dynamically generated IT resolution.

### Step 9: Database Update & Cache Invalidation
Once the API responds, the Consumer updates the Java object (Status: `"AI_RESOLVED"`) and appends the AI's response. It calls `ticketRepository.save(ticket)` to execute a SQL `UPDATE`.
It then explicitly clears the Redis cache (`cacheManager.getCache("all_tickets").clear()`) to ensure absolute sync between Redis and Postgres.

---

## 5. System Resilience: Dead Letter Queue (DLQ) & Error Handling

**KT Note - Designing for Failure:** 
External APIs (like Google Gemini) go down. Network cables get unplugged. As engineers, we must design systems that fail gracefully without losing user data.

### Step 10: Automated Retries (`KafkaConfig.java`)
If `RestTemplate` throws an exception, Spring Kafka's `DefaultErrorHandler` catches the crash. Instead of deleting the ticket, the background thread automatically retries calling Google's API **3 times** (waiting 1 second between each try).

### Step 11: The DLQ Topic (`ticket-events.DLT`)
If it fails all 3 times, the `DeadLetterPublishingRecoverer` safely rips the ticket out of the main pipeline and dumps it into the `ticket-events.DLT` Dead Letter topic.

### Step 12: The Failsafe Listener (`TicketConsumer.java`)
A secondary `@KafkaListener` specifically monitors the DLQ. When it catches a failed ticket, it updates the database status to `"FAILED"` and appends a `[SYSTEM ERROR]` message, ensuring absolute data integrity and zero data loss.

---

## 6. Real-Time UI Synchronization (WebSockets)

How does the React UI instantly know when the AI finishes or when the DLQ fails?

### Step 13: The STOMP Message Broker
The exact millisecond the Consumer (or the DLQ Listener) finishes updating PostgreSQL, it executes:
`messagingTemplate.convertAndSend("/topic/tickets", ticket);`
This instructs the Spring Boot embedded message broker to broadcast the updated ticket object out to the web.

### Step 14: The React SockJS Client (`App.jsx`)
When the React app loaded, it established a persistent WebSocket connection (`ws://localhost:8080/ws`).
- The browser instantly catches the broadcasted STOMP message.
- React maps over its existing `tickets` array in memory and replaces the old ticket with the new object.
- The DOM re-renders the badge (glowing purple `✨ AI_RESOLVED` or glowing red `❌ FAILED`) and expands to reveal the AI response—without a single page refresh.

---

## 7. Security Architecture & JWT Authentication

To ensure the system is enterprise-ready, all APIs and WebSockets are locked down behind Spring Security.

### Step 15: The Login Flow (`AuthController.java`)
Users submit credentials (`admin/password`) to `/api/auth/login`. The backend verifies the credentials and uses `JwtUtil` to generate a cryptographically signed **JSON Web Token (JWT)** using the `HS256` algorithm. React stores this in `localStorage`.

### Step 16: Securing HTTP Requests (`JwtAuthenticationFilter.java`)
React attaches the token to the HTTP header: `Authorization: Bearer <token>`.
Spring Boot's filter intercepts the request, verifies the signature, and injects the user into the `SecurityContext`. Invalid tokens are rejected with `401 Unauthorized`.

### Step 17: Securing WebSockets (`WebSocketConfig.java`)
**KT Note - The WebSocket Security Problem:**
Standard REST APIs are easy to secure: every single time you fire an HTTP request, you can easily attach an `Authorization: Bearer <token>` header to it. 
WebSockets, however, are completely different. A WebSocket is an open, continuous TCP tunnel. Once the tunnel is open, the browser does not allow you to attach custom HTTP headers to the data flowing through it. If we left it like this, *anyone* could connect to our WebSocket and spy on all the company's private IT tickets streaming out of Kafka!

**The Solution (STOMP Interception):**
To solve this, we use the STOMP protocol (Simple Text Oriented Messaging Protocol) on top of WebSockets:
1. **The CONNECT Frame:** Before React is allowed to listen to the data stream, it must send a special introductory message called a `CONNECT` frame. Inside this frame, React sneaks the JWT token into a custom `connectHeader`.
2. **The Security Interceptor:** Inside `WebSocketConfig.java`, we wrote a custom Spring `ChannelInterceptor`. Think of this as a bouncer standing at the door of the WebSocket tunnel.
3. **Validation:** When the `CONNECT` frame arrives at the server, the bouncer (Interceptor) pauses the connection, reaches inside the frame, extracts the JWT token, and passes it to `JwtUtil` to verify the cryptographic signature.
4. **Authorization or Rejection:** If the token is mathematically valid, the bouncer opens the tunnel and allows React to listen to the live Kafka stream. If the token is fake or expired, the bouncer instantly severs the socket connection, completely blocking the unauthorized user from seeing any real-time data.

---

## 8. Quality Assurance & Embedded Integration Testing

**KT Note - Why Embedded Testing?** 
We use Embedded Testing rather than external Docker Testcontainers because it allows the test suite to run in heavily restricted CI/CD pipelines (like Jenkins or GitHub Actions) where the host Docker daemon might be locked down or have API version mismatches.

### Step 18: End-to-End Test Suite (`TicketIntegrationTest.java`)
This suite proves the entire architecture works without manually clicking a browser:
- **In-Memory H2 Database**: Replaces PostgreSQL. Boots in RAM and vanishes after the test, leaving zero footprint.
- **Embedded Kafka**: `@EmbeddedKafka` spins up a functional, lightweight broker inside the JVM on a random port.
- **Cache Bypassing**: External Redis dependencies are bypassed (`spring.cache.type=none`).
- **Validation**: Uses `Awaitility` to pause the thread and continuously poll the database, waiting up to 30 seconds for the asynchronous Kafka consumer to complete the AI processing and write the final `AI_RESOLVED` status back to H2.

---

## 9. Production Architecture (Dockerization)

**KT Note - The Development vs. Production Paradigm:**
During development, the databases (Postgres, Redis, Kafka) were run inside Docker, but the Backend (Java) and Frontend (React/Vite) were run natively on the host OS. This allowed for **Hot Reloading** and prevented permission issues.
However, for deployment, the system must be fully sealed.

### Step 19: The Backend Build Stage (`Dockerfile`)
The backend uses a **Multi-Stage Dockerfile**.
- **Stage 1 (Builder):** Uses the `maven` image to download dependencies (`dependency:go-offline`) and package the Spring Boot `.jar` file.
- **Stage 2 (Runner):** Uses a lightweight `eclipse-temurin:17-jre-alpine` image to execute the compiled `.jar`. This discards all the heavy Maven build tools, resulting in a tiny, secure production image.

### Step 20: The Frontend Build Stage (`Dockerfile`)
The React frontend also uses a **Multi-Stage Dockerfile**.
- **Stage 1 (Builder):** Uses `node:20-alpine` to run `npm install` and `npm run build`, converting the React JSX into highly optimized static HTML, CSS, and JS files.
- **Stage 2 (Runner):** Uses `nginx:alpine` as a high-performance web server to serve the static assets on port `80`. The Vite development server (which handles Hot Module Replacement and proxying) is completely discarded.

### Step 21: Master Orchestration (`docker-compose.yml`)
In production, `docker-compose.yml` manages the entire stack:
- It builds the Frontend and Backend images dynamically via the `build: ./<dir>` directive.
- **Environment Variables:** Crucially, Spring Boot is rewired using environment variables (e.g., `SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432...`). Instead of looking for `localhost`, Java connects directly to the container names (`postgres`, `redis`, `kafka`) over Docker's internal DNS network.
- **Client-Side Execution:** The Nginx container simply serves the frontend static files to the user's browser (e.g., Google Chrome). The browser executes the React logic and fires API calls directly to the exposed backend port (`8080`), eliminating the need for complex `extra_hosts` network bridges.

---

## 10. Continuous Integration & Deployment (CI/CD)

**KT Note - Automation over Manual Work:**
In enterprise environments, engineers do not manually compile code or restart servers. We use GitHub Actions to automate testing and deployment, guaranteeing that broken code is never released to users.

### Step 22: The CI Pipeline (`ci-cd-pipeline.yml`)
The Continuous Integration (CI) pipeline acts as an automated quality gate. On every code push:
- **Environment Setup:** GitHub automatically provisions a fresh `ubuntu-latest` server and installs Java 17 and Node 20.
- **Backend Testing:** It executes `./mvnw clean test`, running the `TicketIntegrationTest` against the Embedded Kafka broker.
- **Frontend Build Check:** It runs `npm ci` and `npm run build` to ensure the React code compiles without syntax errors.
- **The Red/Green Gate:** If any test fails, the pipeline crashes (Red ❌) and blocks the developer from merging the code.

### Step 23: The CD Pipeline & Secrets
The Continuous Deployment (CD) pipeline takes the verified code and pushes it to the live internet.
- **The Dependency (`needs: build-and-test`):** The CD job is strictly locked behind the CI job. It is mathematically impossible for the system to deploy broken code.
- **Branch Protection:** The deployment only triggers `if: github.ref == 'refs/heads/main'`, ensuring experimental branches are tested but never deployed.
- **Secret Management:** Instead of hardcoding passwords, the pipeline uses GitHub Secrets (e.g., `${{ secrets.SERVER_SSH_KEY }}`) to securely log into the remote cloud server, pull the latest code, and execute `docker-compose up -d --build`.
