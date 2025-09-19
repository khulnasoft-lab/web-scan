/**
 * Test AI API without middleware
 */

export default async function handler(req, res) {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log(`🤖 Testing AI analysis for: ${url}`);

    // Simple AI-like analysis
    const analysis = {
      url,
      riskScore: Math.random() * 10,
      vulnerabilities: [
        {
          name: 'Test Vulnerability',
          severity: 'medium',
          description: 'This is a test vulnerability for AI system validation'
        }
      ],
      recommendations: [
        'Implement HTTPS',
        'Add security headers',
        'Update dependencies'
      ],
      confidence: 0.85,
      timestamp: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      message: 'AI Analysis Test Successful',
      analysis
    });

  } catch (error) {
    console.error('❌ Test AI API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
