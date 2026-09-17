package com.intellisupport.backend.controller;

import org.springframework.ai.document.Document;
import org.springframework.ai.reader.ExtractedTextFormatter;
import org.springframework.ai.reader.pdf.PagePdfDocumentReader;
import org.springframework.ai.reader.pdf.config.PdfDocumentReaderConfig;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.Resource;

import java.util.Collections;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
@RestController
@RequestMapping("/api/knowledge-base")
public class KnowledgeBaseController {

    private final VectorStore vectorStore;
    private final JdbcTemplate jdbcTemplate;

    public KnowledgeBaseController(VectorStore vectorStore, JdbcTemplate jdbcTemplate) {
        this.vectorStore = vectorStore;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/documents")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<String>> getUploadedDocuments() {
        try {
            String sql = "SELECT DISTINCT metadata->>'file_name' FROM vector_store WHERE metadata->>'file_name' IS NOT NULL";
            List<String> documents = jdbcTemplate.queryForList(sql, String.class);
            return ResponseEntity.ok(documents);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Collections.emptyList());
        }
    }

    @PostMapping("/upload")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> uploadDocument(@RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body("File is empty.");
            }

            if (!file.getOriginalFilename().toLowerCase().endsWith(".pdf")) {
                return ResponseEntity.badRequest().body("Only PDF files are supported currently.");
            }

            Resource resource = file.getResource();

            PagePdfDocumentReader pdfReader = new PagePdfDocumentReader(resource,
                    PdfDocumentReaderConfig.builder()
                            .withPageExtractedTextFormatter(ExtractedTextFormatter.builder()
                                    .withNumberOfBottomTextLinesToDelete(0)
                                    .withNumberOfTopPagesToSkipBeforeDelete(0)
                                    .build())
                            .withPagesPerDocument(1)
                            .build());

            List<Document> documents = pdfReader.get();

            TokenTextSplitter textSplitter = new TokenTextSplitter();
            List<Document> chunkedDocuments = textSplitter.apply(documents);

            vectorStore.accept(chunkedDocuments);

            return ResponseEntity.ok("Successfully ingested " + chunkedDocuments.size() + " document chunks into the vector store.");

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Failed to process document: " + e.getMessage());
        }
    }

    @DeleteMapping("/documents/{fileName}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> deleteDocument(@PathVariable String fileName) {
        try {
            String sql = "DELETE FROM vector_store WHERE metadata->>'file_name' = ?";
            int rowsDeleted = jdbcTemplate.update(sql, fileName);
            if (rowsDeleted > 0) {
                return ResponseEntity.ok("Successfully deleted " + rowsDeleted + " chunks for document: " + fileName);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Failed to delete document: " + e.getMessage());
        }
    }
}
