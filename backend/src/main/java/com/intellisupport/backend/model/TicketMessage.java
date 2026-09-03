package com.intellisupport.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.io.Serializable;

@Entity
public class TicketMessage implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    
    @ManyToOne
    @JoinColumn(name = "ticket_id")
    @JsonIgnore
    private Ticket ticket;
    
    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;
    
    @Column(nullable = false)
    private String senderRole; // "USER", "AI", "ADMIN"
    
    private LocalDateTime createdAt = LocalDateTime.now();

    public TicketMessage() {}

    public TicketMessage(Ticket ticket, String message, String senderRole) {
        this.ticket = ticket;
        this.message = message;
        this.senderRole = senderRole;
    }

    public String getId() { return id; }
    public Ticket getTicket() { return ticket; }
    public void setTicket(Ticket ticket) { this.ticket = ticket; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getSenderRole() { return senderRole; }
    public void setSenderRole(String senderRole) { this.senderRole = senderRole; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
