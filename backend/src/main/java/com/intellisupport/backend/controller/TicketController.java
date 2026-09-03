package com.intellisupport.backend.controller;

import com.intellisupport.backend.model.Ticket;
import org.springframework.cache.annotation.CachePut;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.intellisupport.backend.model.TicketRepository;
import com.intellisupport.backend.service.TicketProducer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/tickets")
@CrossOrigin(origins = {"http://localhost:5173", "http://144.24.104.175:5173"})
public class TicketController {

    private final TicketRepository ticketRepository;
    private final TicketProducer ticketProducer;
    private final MeterRegistry meterRegistry;

    public TicketController(TicketRepository ticketRepository, TicketProducer ticketProducer, MeterRegistry meterRegistry) {
        this.ticketRepository = ticketRepository;
        this.ticketProducer = ticketProducer;
        this.meterRegistry = meterRegistry;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @CachePut(value = "tickets", key = "#result.id")
    public Ticket createTicket(@RequestBody Ticket ticket, Authentication authentication) {
        ticket.setStatus("OPEN");
        ticket.setCreatedAt(LocalDateTime.now());
        ticket.setUsername(authentication.getName());
        
        com.intellisupport.backend.model.TicketMessage initialMessage = new com.intellisupport.backend.model.TicketMessage(ticket, ticket.getDescription(), "USER");
        ticket.getMessages().add(initialMessage);
        
        Ticket savedTicket = ticketRepository.save(ticket);
        ticketProducer.sendTicketEvent(savedTicket);
        
        meterRegistry.counter("tickets.created.total").increment();
        
        return savedTicket;
    }

    @GetMapping
    public Page<Ticket> getAllTickets(Pageable pageable, Authentication authentication) {
        System.out.println(">>> Fetching paginated tickets");
        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        
        if (isAdmin) {
            return ticketRepository.findAll(pageable);
        } else {
            return ticketRepository.findByUsername(authentication.getName(), pageable);
        }
    }

    @GetMapping("/{id}")
    @Cacheable(value = "tickets", key = "#id")
    public Ticket getTicketById(@PathVariable String id) {
        System.out.println(">>> Cache MISS! Fetching from 'Database' (In-Memory Map) for ID: " + id);
        
        try {
            Thread.sleep(2000); // Simulate slow DB fetch
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        return ticketRepository.findById(id).orElse(null);
    }

    @PostMapping("/{id}/reply")
    @CachePut(value = "tickets", key = "#id")
    public Ticket replyToTicket(@PathVariable String id, @RequestBody java.util.Map<String, String> payload, Authentication authentication) {
        Ticket ticket = ticketRepository.findById(id).orElseThrow(() -> new RuntimeException("Ticket not found"));
        
        String replyText = payload.get("message");
        if (replyText == null || replyText.trim().isEmpty()) {
            throw new IllegalArgumentException("Reply message cannot be empty");
        }

        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        
        String role = isAdmin ? "ADMIN" : "USER";
        
        com.intellisupport.backend.model.TicketMessage replyMessage = new com.intellisupport.backend.model.TicketMessage(ticket, replyText, role);
        ticket.getMessages().add(replyMessage);
        
        if (isAdmin) {
            ticket.setStatus("ADMIN_REPLIED");
        } else {
            ticket.setStatus("OPEN");
            ticketProducer.sendTicketEvent(ticket); // Send to AI only if user replied
        }
        
        return ticketRepository.save(ticket);
    }

    @PostMapping("/{id}/escalate")
    @CachePut(value = "tickets", key = "#id")
    public Ticket escalateTicket(@PathVariable String id) {
        Ticket ticket = ticketRepository.findById(id).orElseThrow(() -> new RuntimeException("Ticket not found"));
        ticket.setStatus("ESCALATED");
        
        meterRegistry.counter("tickets.escalated.total").increment();
        
        return ticketRepository.save(ticket);
    }
}
