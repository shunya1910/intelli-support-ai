package com.intellisupport.backend.service;

import com.intellisupport.backend.model.Ticket;
import com.intellisupport.backend.model.TicketRepository;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.cache.CacheManager;

@Service
public class TicketConsumer {

    private final TicketRepository ticketRepository;
    private final AiService aiService;
    private final SimpMessagingTemplate messagingTemplate;
    private final CacheManager cacheManager;

    public TicketConsumer(TicketRepository ticketRepository, AiService aiService, SimpMessagingTemplate messagingTemplate, CacheManager cacheManager) {
        this.ticketRepository = ticketRepository;
        this.aiService = aiService;
        this.messagingTemplate = messagingTemplate;
        this.cacheManager = cacheManager;
    }

    @KafkaListener(topics = "ticket-events", groupId = "ai-processing-group")
    public void consumeTicketEvent(Ticket ticket) throws Exception {
        System.out.println("<<< [KAFKA CONSUMER] Picked up ticket for background processing: " + ticket.getId());
        
        // Simulate slow, heavy AI processing (e.g. LLM generation time)
        System.out.println("<<< [KAFKA CONSUMER] AI is analyzing the ticket (Simulating delay)...");
        Thread.sleep(4000); // Wait 4 seconds to simulate real-world AI lag

        // Send the ticket to the AI Service for analysis
        // If this throws an exception, Spring Kafka will retry 3 times and then send it to the DLQ!
        String aiResponse = aiService.analyzeTicket(ticket.getDescription());
        
        // "AI" decides the status and resolution
        ticket.setStatus("AI_RESOLVED");
        ticket.setDescription(ticket.getDescription() + "\n\n[AI RESPONSE]:\n" + aiResponse);
        
        // Save the AI-updated ticket back to Postgres
        ticketRepository.save(ticket);
        
        // Clear the Redis cache for the all_tickets list
        if (cacheManager.getCache("all_tickets") != null) {
            cacheManager.getCache("all_tickets").clear();
        }

        // Instantly push the updated ticket to the React Frontend via WebSockets!
        messagingTemplate.convertAndSend("/topic/tickets", ticket);
        
        System.out.println("<<< [KAFKA CONSUMER] Finished processing! Updated DB for ticket: " + ticket.getId());
    }

    @KafkaListener(topics = "ticket-events.DLT", groupId = "ai-processing-group-dlq")
    public void consumeDlqEvent(Ticket ticket) {
        System.err.println(">>> [DLQ] Captured FAILED ticket processing for ID: " + ticket.getId());
        
        ticket.setStatus("FAILED");
        ticket.setDescription(ticket.getDescription() + "\n\n[SYSTEM ERROR]: AI Processing failed after 3 retries.");
        
        ticketRepository.save(ticket);
        
        if (cacheManager.getCache("all_tickets") != null) {
            cacheManager.getCache("all_tickets").clear();
        }
        
        messagingTemplate.convertAndSend("/topic/tickets", ticket);
    }
}
