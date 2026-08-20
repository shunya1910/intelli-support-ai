package com.intellisupport.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import java.util.Map;
import java.util.List;

@Service
public class AiService {

    @Value("${gemini.api.key:mock-key}")
    private String apiKey;

    public String analyzeTicket(String description) {
        System.out.println(">>> Sending ticket to AI Model for analysis...");
        
        // DLQ TRIGGER: If the user types "fail", crash the service!
        if (description.toLowerCase().contains("fail")) {
            throw new RuntimeException("Simulated AI Service Crash for DLQ Testing!");
        }

        // MOCK FALLBACK (If no real API key is provided)
        if ("mock-key".equals(apiKey)) {
            System.out.println(">>> [AI] Using Mock Logic (No API Key provided)");
            if (description.toLowerCase().contains("password")) {
                return "AI Diagnosis: This is a password reset request.\nResolution: Please navigate to auth.company.com.";
            } else if (description.toLowerCase().contains("network") || description.toLowerCase().contains("wifi")) {
                return "AI Diagnosis: Network connectivity issue.\nResolution: Please ensure you are connected to the corporate VPN.";
            } else {
                return "AI Diagnosis: General IT Issue.\nResolution: Escalatated to a human support engineer.";
            }
        }

        // REAL GEMINI INTEGRATION
        try {
            String apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" + apiKey;
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            String prompt = "You are an expert IT assistant. Read the following conversation history for a support ticket. " +
                            "Provide a brief, technical, and helpful response to the user's latest message.\n\n" +
                            "CONVERSATION HISTORY:\n" + description;
            
            Map<String, Object> body = Map.of(
                "contents", List.of(
                    Map.of("parts", List.of(
                        Map.of("text", prompt)
                    ))
                )
            );

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(apiUrl, request, Map.class);
            
            Map<String, Object> responseBody = response.getBody();
            if (responseBody != null && responseBody.containsKey("candidates")) {
                List<Map<String, Object>> candidates = (List<Map<String, Object>>) responseBody.get("candidates");
                Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
                List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
                return (String) parts.get(0).get("text");
            }
            return "AI failed to generate a proper response format.";
        } catch (Exception e) {
            throw new RuntimeException("AI API Call Failed: " + e.getMessage(), e);
        }
    }
}
