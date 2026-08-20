package com.intellisupport.backend.controller;

import com.intellisupport.backend.model.Ticket;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.intellisupport.backend.model.TicketRepository;
import com.intellisupport.backend.service.TicketProducer;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/tickets")
@CrossOrigin(origins = {"http://localhost:5173", "http://144.24.104.175:5173"})
public class TicketController {

    private final TicketRepository ticketRepository;
    private final TicketProducer ticketProducer;

    public TicketController(TicketRepository ticketRepository, TicketProducer ticketProducer) {
        this.ticketRepository = ticketRepository;
        this.ticketProducer = ticketProducer;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @CachePut(value = "tickets", key = "#result.id")
    @CacheEvict(value = "all_tickets", allEntries = true)
    public Ticket createTicket(@RequestBody Ticket ticket) {
        ticket.setStatus("OPEN");
        ticket.setCreatedAt(LocalDateTime.now());
        ticket.setDescription("[USER INITIAL REQUEST]:\n" + ticket.getDescription());
        
        Ticket savedTicket = ticketRepository.save(ticket);
        ticketProducer.sendTicketEvent(savedTicket);
        
        return savedTicket;
    }

    @GetMapping
    @Cacheable(value = "all_tickets")
    public List<Ticket> getAllTickets() {
        System.out.println(">>> Cache MISS! Fetching ALL tickets from Postgres");
        return ticketRepository.findAll();
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
    @CacheEvict(value = "all_tickets", allEntries = true)
    public Ticket replyToTicket(@PathVariable String id, @RequestBody java.util.Map<String, String> payload) {
        Ticket ticket = ticketRepository.findById(id).orElseThrow(() -> new RuntimeException("Ticket not found"));
        
        String userReply = payload.get("message");
        if (userReply == null || userReply.trim().isEmpty()) {
            throw new IllegalArgumentException("Reply message cannot be empty");
        }

        ticket.setDescription(ticket.getDescription() + "\n\n[USER REPLY]:\n" + userReply);
        ticket.setStatus("OPEN"); // Set to open so AI picks it up again
        
        Ticket savedTicket = ticketRepository.save(ticket);
        ticketProducer.sendTicketEvent(savedTicket); // Send it back through Kafka
        
        return savedTicket;
    }
}
