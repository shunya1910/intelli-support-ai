package com.intellisupport.backend.controller;

import com.intellisupport.backend.model.Role;
import com.intellisupport.backend.model.Ticket;
import com.intellisupport.backend.model.TicketRepository;
import com.intellisupport.backend.model.User;
import com.intellisupport.backend.model.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        List<Ticket> allTickets = ticketRepository.findAll();
        
        long openCount = allTickets.stream().filter(t -> "OPEN".equals(t.getStatus())).count();
        long resolvedCount = allTickets.stream().filter(t -> "AI_RESOLVED".equals(t.getStatus()) || "CLOSED".equals(t.getStatus())).count();
        long escalatedCount = allTickets.stream().filter(t -> "ESCALATED".equals(t.getStatus())).count();
        long highSeverityCount = allTickets.stream().filter(t -> "HIGH".equals(t.getSeverity())).count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalTickets", allTickets.size());
        stats.put("openTickets", openCount);
        stats.put("resolvedTickets", resolvedCount);
        stats.put("escalatedTickets", escalatedCount);
        stats.put("highSeverityTickets", highSeverityCount);
        stats.put("totalUsers", userRepository.count());

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/users")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    @PostMapping("/users/{id}/role")
    public ResponseEntity<?> updateUserRole(@PathVariable String id, @RequestBody Map<String, String> body) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        User user = userOpt.get();
        String newRoleStr = body.get("role");
        
        try {
            Role newRole = Role.valueOf(newRoleStr);
            user.setRole(newRole);
            userRepository.save(user);
            return ResponseEntity.ok(user);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Invalid role");
        }
    }
}
