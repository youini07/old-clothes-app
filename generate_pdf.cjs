const fs = require('fs');
const { execSync } = require('child_process');

const markdownFile = '올클_전담IT_파트너쉽_제안서.md';
const tempMarkdownFile = 'temp_proposal.md';
const outputPdfFile = '올클_전담IT_파트너쉽_제안서.pdf';

const style = `
<style>
  body {
    font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
    color: #2d3748;
    line-height: 1.7;
    padding: 40px 50px;
  }
  h1 {
    color: #1a365d;
    border-bottom: 3px solid #e2e8f0;
    padding-bottom: 15px;
    text-align: center;
    margin-bottom: 50px;
    font-size: 2.4em;
    letter-spacing: -1px;
    font-weight: 800;
  }
  h2 {
    color: #2b6cb0;
    margin-top: 45px;
    margin-bottom: 20px;
    border-left: 6px solid #3182ce;
    padding-left: 15px;
    font-size: 1.4em;
    font-weight: 700;
  }
  ul {
    background: #f8fafc;
    padding: 25px 25px 25px 45px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    margin: 20px 0;
  }
  li {
    margin-bottom: 12px;
  }
  strong {
    color: #1a202c;
    font-weight: bold;
  }
  blockquote {
    background-color: #fffbf1;
    border: 1px solid #fde68a;
    border-left: 6px solid #f59e0b;
    padding: 25px 30px;
    margin: 30px 0;
    border-radius: 8px;
    color: #3f3f46;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }
  p {
    margin-bottom: 15px;
    font-size: 1.05em;
  }
</style>
`;

try {
  console.log('Reading markdown file...');
  const content = fs.readFileSync(markdownFile, 'utf8');
  
  console.log('Creating temp styled markdown...');
  fs.writeFileSync(tempMarkdownFile, style + '\n\n' + content, 'utf8');
  
  console.log('Generating PDF using md-to-pdf...');
  execSync('npx -y md-to-pdf temp_proposal.md', { stdio: 'inherit' });
  
  console.log('Renaming output file...');
  if (fs.existsSync('temp_proposal.pdf')) {
      fs.renameSync('temp_proposal.pdf', outputPdfFile);
      console.log('PDF generated successfully: ' + outputPdfFile);
  } else {
      console.error('PDF file was not created.');
  }
  
  // Cleanup
  if (fs.existsSync(tempMarkdownFile)) fs.unlinkSync(tempMarkdownFile);
} catch (error) {
  console.error('Error generating PDF:', error.message);
}
