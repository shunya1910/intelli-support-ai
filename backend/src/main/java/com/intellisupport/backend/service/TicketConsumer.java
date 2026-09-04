package com.intellisupport.backend.service;

import com.intellisupport.backend.model.Ticket;
import com.intellisupport.backend.model.TicketRepository;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.cache.CacheManager;
import io.micrometer.core.instrument.MeterRegistry;

@Service
public class TicketConsumer {

    private final TicketRepository ticketRepository;
    private final AiService aiService;
    private final SimpMessagingTemplate messagingTemplate;
    private final CacheManager cacheManager;
    private final MeterRegistry meterRegistry;

    public TicketConsumer(TicketRepository ticketRepository, AiService aiService, SimpMessagingTemplate messagingTemplate, CacheManager cacheManager, MeterRegistry meterRegistry) {
        this.ticketRepository = ticketRepository;
        this.aiService = aiService;
        this.messagingTemplate = messagingTemplate;
        this.cacheManager = cacheManager;
        this.meterRegistry = meterRegistry;
    }

    @KafkaListener(topics = "ticket-events", groupId = "ai-processing-group")
    public void consumeTicketEvent(Ticket kafkaTicket) throws Exception {
        try {
            System.out.println("<<< [KAFKA CONSUMER] Picked up ticket for background processing: " + kafkaTicket.getId());
        
        Ticket ticket = ticketRepository.findById(kafkaTicket.getId()).orElse(kafkaTicket);

        // Simulate slow, heavy AI processing
        System.out.println("<<< [KAFKA CONSUMER] AI is analyzing the ticket (Simulating delay)...");
        Thread.sleep(4000);

        StringBuilder history = new StringBuilder();
        history.append("Ticket Description: ").append(ticket.getDescription()).append("\n\n");
        for (com.intellisupport.backend.model.TicketMessage msg : ticket.getMessages()) {
            history.append("[").append(msg.getSenderRole()).append("]: ").append(msg.getMessage()).append("\n\n");
        }

        String aiResponse = aiService.analyzeTicket(history.toString());
        
        ticket.setStatus("AI_RESOLVED");
        
        com.intellisupport.backend.model.TicketMessage aiMessage = new com.intellisupport.backend.model.TicketMessage(ticket, aiResponse, "AI");
        ticket.getMessages().add(aiMessage);
        
        // Save the AI-updated ticket back to Postgres
        ticketRepository.save(ticket);
        
        meterRegistry.counter("tickets.resolved.ai.total").increment();
        
        // Clear the Redis cache for the all_tickets list
        if (cacheManager.getCache("all_tickets") != null) {
            cacheManager.getCache("all_tickets").clear();
        }

        // Instantly push the updated ticket to the React Frontend via WebSockets!
        messagingTemplate.convertAndSend("/topic/tickets", ticket);
        
        System.out.println("<<< [KAFKA CONSUMER] Finished processing! Updated DB for ticket: " + ticket.getId());
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }
    }

    @KafkaListener(topics = "ticket-events.DLT", groupId = "ai-processing-group-dlq")
    public void consumeDlqEvent(Ticket kafkaTicket) {
        System.err.println(">>> [DLQ] Captured FAILED ticket processing for ID: " + kafkaTicket.getId());
        
        Ticket ticket = ticketRepository.findById(kafkaTicket.getId()).orElse(kafkaTicket);
        ticket.setStatus("FAILED");
        
        com.intellisupport.backend.model.TicketMessage sysMessage = new com.intellisupport.backend.model.TicketMessage(ticket, "AI Processing failed after 3 retries.", "SYSTEM");
        ticket.getMessages().add(sysMessage);
        
        ticketRepository.save(ticket);
        
        meterRegistry.counter("tickets.failed.dlq.total").increment();
        
        if (cacheManager.getCache("all_tickets") != null) {
            cacheManager.getCache("all_tickets").clear();
        }
        
        messagingTemplate.convertAndSend("/topic/tickets", ticket);
    }
}