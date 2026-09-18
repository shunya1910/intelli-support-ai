package com.intellisupport.backend.service;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.javamail.MimeMessageHelper;

@Service
public class EmailService {

    private final JavaMailSender mailSender;
    private final com.intellisupport.backend.model.UserRepository userRepository;

    public EmailService(JavaMailSender mailSender, com.intellisupport.backend.model.UserRepository userRepository) {
        this.mailSender = mailSender;
        this.userRepository = userRepository;
    }

    public void sendTicketUpdateEmail(String username, String ticketTitle, String replyText) {
        com.intellisupport.backend.model.User user = userRepository.findByUsername(username).orElse(null);
        if (user == null || user.getEmail() == null || user.getEmail().trim().isEmpty()) {
            System.out.println(">>> Skipping email for " + username + " (No valid email address found)");
            return;
        }
        String toEmail = user.getEmail();
        
        System.out.println(">>> Sending email to " + toEmail);
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            
            helper.setFrom("noreply@intellisupport.com");
            helper.setTo(toEmail);
            helper.setSubject("Update on your Support Ticket: " + ticketTitle);
            
            // Replace markdown **text** with HTML bold and italic tags, and \n with <br>
            String formattedReply = replyText.replaceAll("\\*\\*(.*?)\\*\\*", "<b><i>$1</i></b>").replace("\n", "<br>");
            
            String body = "Hi there,<br><br>" +
                          "Your ticket has just received a new reply:<br><br>" +
                          "\"" + formattedReply + "\"<br><br>" +
                          "Please log into the IntelliSupport dashboard to view the full ticket.<br><br>" +
                          "<br><br>" +
                          "<hr style='border: none; border-top: 1px solid #eee; margin-top: 20px;'>" +
                          "<div style='font-family: Arial, sans-serif; color: #555;'>" +
                          "  <strong style='color: #6366f1; font-size: 16px;'>The IntelliSupport Team</strong><br>" +
                          "  <span style='font-size: 12px; color: #888;'>AI-Powered Incident Engine</span><br>" +
                          "  <a href='http://localhost:5173' style='color: #6366f1; text-decoration: none; font-size: 12px;'>Visit Dashboard</a>" +
                          "</div>";
                          
            helper.setText(body, true);
            mailSender.send(message);
            System.out.println(">>> Email sent successfully!");
        } catch (Exception e) {
            System.err.println("Failed to send email: " + e.getMessage());
        }
    }
}
