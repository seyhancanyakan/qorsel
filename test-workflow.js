// Test workflow execution
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function testWorkflow() {
  // Simulate form submission
  const formData = new FormData();
  formData.append('prompt1', 'Test prompt 1');
  formData.append('prompt2', 'Test prompt 2');
  formData.append('steps', '4');
  formData.append('cfg', '1');
  formData.append('width', '1920');
  formData.append('height', '1080');
  formData.append('image1Name', 'test1.png');
  formData.append('image2Name', 'test2.png');

  console.log('Sending test workflow...');
  const res = await fetch('http://localhost:3000/api/qwen-edit/run', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

testWorkflow().catch(console.error);
