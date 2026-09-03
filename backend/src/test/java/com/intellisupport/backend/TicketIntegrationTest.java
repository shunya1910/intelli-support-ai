package com.intellisupport.backend;

import com.intellisupport.backend.model.Ticket;
import com.intellisupport.backend.model.TicketRepository;
import com.intellisupport.backend.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeAll;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.context.TestPropertySource;
import org.awaitility.Awaitility;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@EmbeddedKafka(partitions = 1, topics = {"ticket-events", "ticket-events.DLT"})
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=false",
    "spring.datasource.driverClassName=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.cache.type=none",
    "spring.data.redis.repositories.enabled=false",
    "gemini.api.key=mock-key",
    "spring.kafka.bootstrap-servers=${spring.embedded.kafka.brokers}"
})
public class TicketIntegrationTest {

    @LocalServerPort
    private int port;

    private RestTemplate restTemplate = new RestTemplate();

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Test
    void testEndToEndTicketCreationAndResolution() {
        // 1. Generate JWT Token
        String token = jwtUtil.generateToken("admin", "ADMIN");
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);

        // 2. Create Ticket Payload
        Map<String, String> requestBody = Map.of(
                "title", "Integration Test Issue",
                "description", "My password needs reset"
        );
        HttpEntity<Map<String, String>> request = new HttpEntity<>(requestBody, headers);

        // 3. Fire API Request
        ResponseEntity<Ticket> response = restTemplate.exchange("http://localhost:" + port + "/api/tickets", HttpMethod.POST, request, Ticket.class);
        
        // 4. Validate Synchronous Response
        assertEquals(201, response.getStatusCode().value());
        Ticket createdTicket = response.getBody();
        assertNotNull(createdTicket);
        assertNotNull(createdTicket.getId());
        assertEquals("OPEN", createdTicket.getStatus());

        // 5. Wait for Asynchronous Kafka Worker to process it (mock AI takes ~4s)
        Awaitility.await()
                .atMost(Duration.ofSeconds(10))
                .pollInterval(Duration.ofSeconds(1))
                .untilAsserted(() -> {
                    Optional<Ticket> processedTicket = ticketRepository.findById(createdTicket.getId());
                    assertTrue(processedTicket.isPresent());
                    assertEquals("AI_RESOLVED", processedTicket.get().getStatus());
                    assertTrue(processedTicket.get().getDescription().contains("AI Diagnosis"));
                });
    }

    @Test
    void testEndToEndDeadLetterQueueRecovery() {
        String token = jwtUtil.generateToken("admin", "ADMIN");
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);

        // Create Ticket that triggers a "fail"
        Map<String, String> requestBody = Map.of(
                "title", "DLQ Test Issue",
                "description", "force fail"
        );
        HttpEntity<Map<String, String>> request = new HttpEntity<>(requestBody, headers);
        ResponseEntity<Ticket> response = restTemplate.exchange("http://localhost:" + port + "/api/tickets", HttpMethod.POST, request, Ticket.class);
        
        assertEquals(201, response.getStatusCode().value());
        String ticketId = response.getBody().getId();

        // Wait for Kafka to retry 3 times and send to DLQ
        Awaitility.await()
                .atMost(Duration.ofSeconds(30))
                .pollInterval(Duration.ofSeconds(1))
                .untilAsserted(() -> {
                    Optional<Ticket> processedTicket = ticketRepository.findById(ticketId);
                    assertTrue(processedTicket.isPresent());
                    assertEquals("FAILED", processedTicket.get().getStatus());
                    assertTrue(processedTicket.get().getDescription().contains("[SYSTEM ERROR]"));
                });
    }
}
