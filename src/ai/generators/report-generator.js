/**
 * AI-Powered Report Generator
 * Generates intelligent, natural language security reports with AI insights
 */

import natural from 'natural';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

export class ReportGenerator {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    // Fix: Use simple sentiment analysis instead of complex SentimentAnalyzer
    // The SentimentAnalyzer constructor is problematic, use simpler approach
    this.sentiment = null; // Will use natural.SentimentAnalyzer.analyze() directly
    
    // Report templates
    this.templates = {
      executive: 'executive-summary',
      technical: 'technical-detailed',
      compliance: 'compliance-focused',
      remediation: 'remediation-plan'
    };
    
    // Risk level mappings
    this.riskLevels = {
      0: { level: 'Minimal', color: [0, 0.8, 0], description: 'Very low security risk' },
      1: { level: 'Low', color: [0.4, 0.8, 0], description: 'Low security risk with minor issues' },
      2: { level: 'Medium-Low', color: [0.8, 0.8, 0], description: 'Some security concerns present' },
      3: { level: 'Medium', color: [1, 0.6, 0], description: 'Moderate security risks identified' },
      4: { level: 'Medium-High', color: [1, 0.4, 0], description: 'Significant security issues found' },
      5: { level: 'High', color: [1, 0.2, 0], description: 'High security risk requiring attention' },
      6: { level: 'Critical', color: [1, 0, 0], description: 'Critical security vulnerabilities present' }
    };
  }

  /**
   * Generate comprehensive security report
   */
  async generateReport(analysisData, options = {}) {
    const {
      format = 'pdf',
      template = 'technical',
      includeCharts = true,
      includeRecommendations = true,
      language = 'en'
    } = options;

    try {
      // Process and analyze the data
      const processedData = await this.processAnalysisData(analysisData);
      
      // Generate natural language insights
      const insights = await this.generateInsights(processedData);
      
      // Create report structure
      const reportStructure = await this.createReportStructure(
        processedData, insights, template
      );
      
      // Generate final report based on format
      if (format === 'pdf') {
        return await this.generatePDFReport(reportStructure, options);
      } else if (format === 'html') {
        return await this.generateHTMLReport(reportStructure, options);
      } else if (format === 'json') {
        return this.generateJSONReport(reportStructure, options);
      }
      
      throw new Error(`Unsupported report format: ${format}`);
    } catch (error) {
      console.error('Report generation failed:', error);
      throw new Error(`Report generation failed: ${error.message}`);
    }
  }

  /**
   * Process raw analysis data into structured format
   */
  async processAnalysisData(data) {
    const processed = {
      metadata: {
        url: data.url || 'Unknown',
        timestamp: new Date().toISOString(),
        analysisType: data.type || 'comprehensive',
        duration: data.duration || 0
      },
      security: {
        overallScore: this.calculateOverallScore(data),
        vulnerabilities: this.categorizeVulnerabilities(data.vulnerabilities || []),
        threats: data.threats || [],
        compliance: data.compliance || {}
      },
      performance: {
        healthScore: data.healthScore || 0,
        metrics: data.metrics || {},
        trends: data.trends || []
      },
      recommendations: this.prioritizeRecommendations(data.recommendations || [])
    };

    return processed;
  }

  /**
   * Generate natural language insights using NLP
   */
  async generateInsights(data) {
    const insights = {
      summary: await this.generateExecutiveSummary(data),
      keyFindings: await this.generateKeyFindings(data),
      riskAssessment: await this.generateRiskAssessment(data),
      recommendations: await this.generateRecommendationText(data),
      trends: await this.generateTrendAnalysis(data)
    };

    return insights;
  }

  /**
   * Generate executive summary using AI
   */
  async generateExecutiveSummary(data) {
    const { security, performance, metadata } = data;
    const riskLevel = this.getRiskLevel(security.overallScore);
    
    let summary = `Security Analysis Report for ${metadata.url}\n\n`;
    
    summary += `Overall Security Assessment: ${riskLevel.level} Risk (${security.overallScore}/10)\n`;
    summary += `${riskLevel.description}\n\n`;
    
    // Vulnerability summary
    const vulnCount = security.vulnerabilities.critical.length + 
                     security.vulnerabilities.high.length + 
                     security.vulnerabilities.medium.length;
    
    if (vulnCount > 0) {
      summary += `Key Security Findings:\n`;
      summary += `• ${security.vulnerabilities.critical.length} Critical vulnerabilities identified\n`;
      summary += `• ${security.vulnerabilities.high.length} High-priority security issues\n`;
      summary += `• ${security.vulnerabilities.medium.length} Medium-priority concerns\n\n`;
    } else {
      summary += `No significant security vulnerabilities detected.\n\n`;
    }
    
    // Performance summary
    summary += `System Health Score: ${performance.healthScore}/10\n`;
    
    if (performance.healthScore < 7) {
      summary += `Performance optimization recommended to improve system reliability.\n`;
    } else {
      summary += `System performance is within acceptable parameters.\n`;
    }
    
    return summary;
  }

  /**
   * Generate key findings with natural language processing
   */
  async generateKeyFindings(data) {
    const findings = [];
    
    // Security findings
    if (data.security.vulnerabilities.critical.length > 0) {
      findings.push({
        category: 'Critical Security Issues',
        severity: 'critical',
        description: `${data.security.vulnerabilities.critical.length} critical security vulnerabilities require immediate attention`,
        impact: 'High risk of security breach or data compromise',
        urgency: 'Immediate action required'
      });
    }
    
    // Performance findings
    if (data.performance.healthScore < 6) {
      findings.push({
        category: 'Performance Concerns',
        severity: 'high',
        description: 'System performance is below optimal levels',
        impact: 'May affect user experience and system reliability',
        urgency: 'Address within 48 hours'
      });
    }
    
    // Compliance findings
    const complianceIssues = Object.values(data.security.compliance)
      .filter(item => item.status === 'non-compliant').length;
    
    if (complianceIssues > 0) {
      findings.push({
        category: 'Compliance Issues',
        severity: 'medium',
        description: `${complianceIssues} compliance requirements not met`,
        impact: 'Potential regulatory or audit issues',
        urgency: 'Address within 1 week'
      });
    }
    
    return findings;
  }

  /**
   * Generate risk assessment narrative
   */
  async generateRiskAssessment(data) {
    const riskLevel = this.getRiskLevel(data.security.overallScore);
    
    let assessment = `Risk Level: ${riskLevel.level}\n\n`;
    
    assessment += `Risk Factors:\n`;
    
    // Analyze vulnerability distribution
    const vulns = data.security.vulnerabilities;
    if (vulns.critical.length > 0) {
      assessment += `• Critical Vulnerabilities: ${vulns.critical.length} issues pose immediate security risks\n`;
    }
    if (vulns.high.length > 0) {
      assessment += `• High-Priority Issues: ${vulns.high.length} vulnerabilities require prompt attention\n`;
    }
    
    // Performance risk factors
    if (data.performance.healthScore < 7) {
      assessment += `• Performance Risk: System health score of ${data.performance.healthScore}/10 indicates stability concerns\n`;
    }
    
    // Trend analysis
    if (data.performance.trends.length > 0) {
      const negativetrends = data.performance.trends.filter(t => t.direction === 'declining');
      if (negativetrends.length > 0) {
        assessment += `• Declining Trends: ${negativetrends.length} metrics showing negative trends\n`;
      }
    }
    
    assessment += `\nRecommended Actions:\n`;
    assessment += `• Immediate: Address critical and high-priority vulnerabilities\n`;
    assessment += `• Short-term: Implement security hardening measures\n`;
    assessment += `• Long-term: Establish continuous monitoring and improvement processes\n`;
    
    return assessment;
  }

  /**
   * Generate PDF report
   */
  async generatePDFReport(reportStructure, options) {
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    
    let page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();
    let yPosition = height - 50;
    
    // Title
    page.drawText('Security Analysis Report', {
      x: 50,
      y: yPosition,
      size: 24,
      font: timesRomanBoldFont,
      color: rgb(0, 0, 0)
    });
    yPosition -= 40;
    
    // Metadata
    page.drawText(`URL: ${reportStructure.metadata.url}`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: timesRomanFont
    });
    yPosition -= 20;
    
    page.drawText(`Generated: ${new Date(reportStructure.metadata.timestamp).toLocaleString()}`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: timesRomanFont
    });
    yPosition -= 40;
    
    // Executive Summary
    page.drawText('Executive Summary', {
      x: 50,
      y: yPosition,
      size: 18,
      font: timesRomanBoldFont
    });
    yPosition -= 30;
    
    // Split summary into lines
    const summaryLines = this.splitTextIntoLines(reportStructure.insights.summary, 80);
    for (const line of summaryLines) {
      if (yPosition < 50) {
        page = pdfDoc.addPage([612, 792]);
        yPosition = height - 50;
      }
      
      page.drawText(line, {
        x: 50,
        y: yPosition,
        size: 11,
        font: timesRomanFont
      });
      yPosition -= 15;
    }
    
    // Risk Assessment Section
    yPosition -= 20;
    page.drawText('Risk Assessment', {
      x: 50,
      y: yPosition,
      size: 18,
      font: timesRomanBoldFont
    });
    yPosition -= 30;
    
    const riskLines = this.splitTextIntoLines(reportStructure.insights.riskAssessment, 80);
    for (const line of riskLines) {
      if (yPosition < 50) {
        page = pdfDoc.addPage([612, 792]);
        yPosition = height - 50;
      }
      
      page.drawText(line, {
        x: 50,
        y: yPosition,
        size: 11,
        font: timesRomanFont
      });
      yPosition -= 15;
    }
    
    const pdfBytes = await pdfDoc.save();
    return {
      format: 'pdf',
      data: pdfBytes,
      filename: `security-report-${Date.now()}.pdf`,
      size: pdfBytes.length
    };
  }

  /**
   * Generate HTML report
   */
  async generateHTMLReport(reportStructure, options) {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Security Analysis Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
            .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .section { margin-bottom: 30px; }
            .risk-high { color: #d32f2f; font-weight: bold; }
            .risk-medium { color: #f57c00; font-weight: bold; }
            .risk-low { color: #388e3c; font-weight: bold; }
            .vulnerability { background: #f5f5f5; padding: 15px; margin: 10px 0; border-left: 4px solid #2196f3; }
            .critical { border-left-color: #d32f2f; }
            .high { border-left-color: #f57c00; }
            .medium { border-left-color: #fbc02d; }
            .recommendation { background: #e8f5e8; padding: 15px; margin: 10px 0; border-radius: 5px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Security Analysis Report</h1>
            <p><strong>URL:</strong> ${reportStructure.metadata.url}</p>
            <p><strong>Generated:</strong> ${new Date(reportStructure.metadata.timestamp).toLocaleString()}</p>
            <p><strong>Overall Risk Score:</strong> ${reportStructure.security.overallScore}/10</p>
        </div>
        
        <div class="section">
            <h2>Executive Summary</h2>
            <pre>${reportStructure.insights.summary}</pre>
        </div>
        
        <div class="section">
            <h2>Key Findings</h2>
            ${reportStructure.insights.keyFindings.map(finding => `
                <div class="vulnerability ${finding.severity}">
                    <h3>${finding.category}</h3>
                    <p><strong>Description:</strong> ${finding.description}</p>
                    <p><strong>Impact:</strong> ${finding.impact}</p>
                    <p><strong>Urgency:</strong> ${finding.urgency}</p>
                </div>
            `).join('')}
        </div>
        
        <div class="section">
            <h2>Risk Assessment</h2>
            <pre>${reportStructure.insights.riskAssessment}</pre>
        </div>
        
        <div class="section">
            <h2>Recommendations</h2>
            ${reportStructure.recommendations.map(rec => `
                <div class="recommendation">
                    <h3>${rec.title}</h3>
                    <p>${rec.description}</p>
                    <p><strong>Priority:</strong> ${rec.priority}</p>
                </div>
            `).join('')}
        </div>
    </body>
    </html>
    `;
    
    return {
      format: 'html',
      data: html,
      filename: `security-report-${Date.now()}.html`,
      size: html.length
    };
  }

  /**
   * Generate JSON report
   */
  generateJSONReport(reportStructure, options) {
    const jsonData = JSON.stringify(reportStructure, null, 2);
    
    return {
      format: 'json',
      data: jsonData,
      filename: `security-report-${Date.now()}.json`,
      size: jsonData.length
    };
  }

  // Helper methods
  calculateOverallScore(data) {
    if (data.overallScore !== undefined) return data.overallScore;
    
    let score = 10;
    const vulnerabilities = data.vulnerabilities || [];
    
    // Deduct points based on vulnerabilities
    vulnerabilities.forEach(vuln => {
      switch (vuln.severity) {
        case 'critical': score -= 2; break;
        case 'high': score -= 1.5; break;
        case 'medium': score -= 1; break;
        case 'low': score -= 0.5; break;
      }
    });
    
    return Math.max(0, Math.min(10, score));
  }

  categorizeVulnerabilities(vulnerabilities) {
    return {
      critical: vulnerabilities.filter(v => v.severity === 'critical'),
      high: vulnerabilities.filter(v => v.severity === 'high'),
      medium: vulnerabilities.filter(v => v.severity === 'medium'),
      low: vulnerabilities.filter(v => v.severity === 'low')
    };
  }

  prioritizeRecommendations(recommendations) {
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });
  }

  getRiskLevel(score) {
    const level = Math.floor(score / 1.67); // Convert 0-10 to 0-6 scale
    return this.riskLevels[Math.min(6, Math.max(0, level))];
  }

  splitTextIntoLines(text, maxLength) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      if ((currentLine + word).length <= maxLength) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  async createReportStructure(processedData, insights, template) {
    return {
      metadata: processedData.metadata,
      security: processedData.security,
      performance: processedData.performance,
      recommendations: processedData.recommendations,
      insights: insights,
      template: template,
      generatedAt: new Date().toISOString()
    };
  }

  async generateRecommendationText(data) {
    const recommendations = data.recommendations;
    let text = 'Recommended Actions:\n\n';
    
    recommendations.forEach((rec, index) => {
      text += `${index + 1}. ${rec.title}\n`;
      text += `   Priority: ${rec.priority}\n`;
      text += `   Description: ${rec.description}\n\n`;
    });
    
    return text;
  }

  async generateTrendAnalysis(data) {
    const trends = data.performance.trends || [];
    let analysis = 'Trend Analysis:\n\n';
    
    if (trends.length === 0) {
      analysis += 'Insufficient historical data for trend analysis.\n';
      return analysis;
    }
    
    trends.forEach(trend => {
      analysis += `• ${trend.metric}: ${trend.direction} trend (${trend.change}%)\n`;
    });
    
    return analysis;
  }
}

export default ReportGenerator;
