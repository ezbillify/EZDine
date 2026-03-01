const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Store print jobs for debugging
const printJobs = [];

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'EZDine Print Server is running',
    timestamp: new Date().toISOString(),
    totalJobs: printJobs.length
  });
});

// Get recent print jobs (for debugging)
app.get('/jobs', (req, res) => {
  res.json({
    jobs: printJobs.slice(-10), // Last 10 jobs
    total: printJobs.length
  });
});

// Main print endpoint
app.post('/print', (req, res) => {
  const job = req.body;
  const timestamp = new Date().toISOString();
  
  // Store job for debugging
  printJobs.push({
    ...job,
    timestamp,
    id: printJobs.length + 1
  });

  console.log('\n🖨️ ================================');
  console.log('📄 PRINT JOB RECEIVED');
  console.log('🕐 Time:', new Date().toLocaleString());
  console.log('🖨️ Printer ID:', job.printerId);
  console.log('📏 Paper Width:', job.width + 'mm');
  console.log('📋 Print Type:', job.type.toUpperCase());
  console.log('🔢 Job #:', printJobs.length);
  console.log('================================');
  
  // Print the content
  if (job.lines && job.lines.length > 0) {
    console.log('📝 CONTENT:');
    job.lines.forEach((line, index) => {
      const alignment = line.align || 'left';
      const weight = line.bold ? ' (BOLD)' : '';
      const prefix = alignment === 'center' ? '    ' : 
                    alignment === 'right' ? '        ' : '';
      console.log(`${prefix}${line.text}${weight}`);
    });
  }
  
  console.log('================================');
  console.log('✅ Print job processed successfully');
  console.log('🔄 Total jobs processed:', printJobs.length);
  console.log('================================\n');

  // Simulate different printer responses
  if (job.printerId === 'error-test') {
    return res.status(500).json({
      success: false,
      error: 'Simulated printer error'
    });
  }

  // Success response
  res.json({
    success: true,
    message: 'Print job sent to printer successfully',
    jobId: printJobs.length,
    timestamp: timestamp,
    printer: job.printerId,
    lines: job.lines?.length || 0
  });
});

// Clear print jobs (for testing)
app.delete('/jobs', (req, res) => {
  const count = printJobs.length;
  printJobs.length = 0;
  console.log(`🗑️ Cleared ${count} print jobs`);
  res.json({ message: `Cleared ${count} print jobs` });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health - Check server status',
      'POST /print - Send print job',
      'GET /jobs - View recent print jobs',
      'DELETE /jobs - Clear print job history'
    ]
  });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log('\n🚀 ================================');
  console.log('🖨️  EZDINE PRINT SERVER STARTED');
  console.log('================================');
  console.log('🌐 Server URL:', `http://localhost:${PORT}`);
  console.log('💚 Health Check:', `http://localhost:${PORT}/health`);
  console.log('📋 View Jobs:', `http://localhost:${PORT}/jobs`);
  console.log('🔧 Ready to receive print jobs from EZDine web app');
  console.log('================================\n');
  
  console.log('📖 USAGE:');
  console.log('1. Go to EZDine Settings > Printing Setup');
  console.log('2. Set Print Server URL to: http://localhost:8080');
  console.log('3. Click "Test Server" to verify connection');
  console.log('4. Click "Test Print" to send a test job');
  console.log('5. Use POS system - all prints will show here!\n');
});