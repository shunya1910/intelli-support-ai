package com.intellisupport.backend.service;

import com.intellisupport.backend.model.Ticket;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class TicketProducer {

    private static final String TOPIC = "ticket-events";

    private final KafkaTemplate<String, Ticket> kafkaTemplate;

    public TicketProducer(KafkaTemplate<String, Ticket> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void sendTicketEvent(Ticket ticket) {
        System.out.println(">>> Publishing Ticket Event to Kafka Topic: " + TOPIC + " | ID: " + ticket.getId());
        kafkaTemplate.send(TOPIC, ticket.getId(), ticket);
    }
}