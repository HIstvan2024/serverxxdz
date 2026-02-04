// server.js
const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

let browser = null;

// === BROWSER INITIALIZATION ===
async function initBrowser() {
  browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-gpu']
  });
  console.log('Browser initialized');
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getBaseUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    const match = url.match(/^(https?:\/\/[^\/]+)/i);
    return match ? match[1] : '';
  }
}

function cleanUrl(rawUrl, baseUrl) {
  if (!rawUrl) return '';
  let cleaned = rawUrl.replace(/\s*["'][^"']*["']\s*$/, '').trim();
  cleaned = cleaned.replace(/["'\s]+$/, '').trim();
  
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  
  if (baseUrl) {
    const base = getBaseUrl(baseUrl);
    if (base) {
      if (cleaned.startsWith('//')) return 'https:' + cleaned;
      if (cleaned.startsWith('/')) return base + cleaned;
      return base + '/' + cleaned;
    }
  }
  return cleaned;
}

function preprocessContent(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/https?:\/\/[^\s\)]+/g, ' ')
    .replace(/\!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\b\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}\b/g, ' ')
    .replace(/\b\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4}\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')
    .replace(/[\$€£]\s?\d+[\d\s,.]*\b/g, ' ')
    .replace(/\s*[-–—]\s*/g, '-')
    .replace(/\s*\/\s*/g, '/')
    .trim();
}

// ============================================================
// PHONE EXTRACTION - HUNGARIAN
// ============================================================

function extractHungarianPhones(text) {
  const results = [];
  const seen = new Set();
  
  const patterns = [
    { regex: /\+36[\s.-]?(\d{1,2})[\s.-]?(\d{3})[\s.-]?(\d{3,4})/g, normalize: (m) => `+36 ${m[1]} ${m[2]} ${m[3]}` },
    { regex: /00[\s.-]?36[\s.-]?(\d{1,2})[\s.-]?(\d{3})[\s.-]?(\d{3,4})/g, normalize: (m) => `+36 ${m[1]} ${m[2]} ${m[3]}` },
    { regex: /(?<!\d)06[\s.-]?(1|20|30|31|50|70)[\s.-]?(\d{3})[\s.-]?(\d{3,4})(?!\d)/g, normalize: (m) => `+36 ${m[1]} ${m[2]} ${m[3]}` },
    { regex: /\(06[\s.-]?1\)[\s.-]?(\d{3})[\s.-]?(\d{4})/g, normalize: (m) => `+36 1 ${m[1]} ${m[2]}` },
    { regex: /(?<!\d)36[\s.-]?(1|20|30|31|50|70)[\s.-]?(\d{3})[\s.-]?(\d{3,4})(?!\d)/g, normalize: (m) => `+36 ${m[1]} ${m[2]} ${m[3]}` }
  ];

  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    while ((match = regex.exec(text)) !== null) {
      const normalized = pattern.normalize(match);
      const digitsOnly = normalized.replace(/\D/g, '');
      if (digitsOnly.length >= 10 && digitsOnly.length <= 12 && !seen.has(digitsOnly)) {
        seen.add(digitsOnly);
        results.push({ number: normalized, country: 'HU' });
      }
    }
  }
  return results;
}

// ============================================================
// PHONE EXTRACTION - SLOVAK
// ============================================================

function extractSlovakPhones(text) {
  const results = [];
  const seen = new Set();
  
  const patterns = [
    { regex: /\+421[\s.-]?(\d{1,3})[\s.-]?(\d{3})[\s.-]?(\d{3})/g, normalize: (m) => `+421 ${m[1]} ${m[2]} ${m[3]}` },
    { regex: /00[\s.-]?421[\s.-]?(\d{1,3})[\s.-]?(\d{3})[\s.-]?(\d{3})/g, normalize: (m) => `+421 ${m[1]} ${m[2]} ${m[3]}` },
    { regex: /(?<!\d)0(9[01456789]\d)[\s.-]?(\d{3})[\s.-]?(\d{3})(?!\d)/g, normalize: (m) => `+421 ${m[1]} ${m[2]} ${m[3]}` },
    { regex: /(?<!\d)0(2)[\s.-]?(\d{4})[\s.-]?(\d{4})(?!\d)/g, normalize: (m) => `+421 ${m[1]} ${m[2]} ${m[3]}` },
    { regex: /(?<!\d)0([3-5]\d)[\s.-]?(\d{3})[\s.-]?(\d{4})(?!\d)/g, normalize: (m) => `+421 ${m[1]} ${m[2]} ${m[3]}` }
  ];

  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    while ((match = regex.exec(text)) !== null) {
      const normalized = pattern.normalize(match);
      const digitsOnly = normalized.replace(/\D/g, '');
      if (digitsOnly.length >= 11 && digitsOnly.length <= 13 && !seen.has(digitsOnly)) {
        seen.add(digitsOnly);
        results.push({ number: normalized, country: 'SK' });
      }
    }
  }
  return results;
}

// ============================================================
// PHONE EXTRACTION - CZECH
// ============================================================

function extractCzechPhones(text) {
  const results = [];
  const seen = new Set();
  
  const patterns = [
    { regex: /\+420[\s.-]?(\d{3})[\s.-]?(\d{3})[\s.-]?(\d{3})/g, normalize: (m) => `+420 ${m[1]} ${m[2]} ${m[3]}` },
    { regex: /00[\s.-]?420[\s.-]?(\d{3})[\s.-]?(\d{3})[\s.-]?(\d{3})/g, normalize: (m) => `+420 ${m[1]} ${m[2]} ${m[3]}` },
    { regex: /(?<!\d)420[\s.-]?(\d{3})[\s.-]?(\d{3})[\s.-]?(\d{3})(?!\d)/g, normalize: (m) => `+420 ${m[1]} ${m[2]} ${m[3]}` }
  ];

  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    while ((match = regex.exec(text)) !== null) {
      const normalized = pattern.normalize(match);
      const digitsOnly = normalized.replace(/\D/g, '');
      if (digitsOnly.length >= 11 && digitsOnly.length <= 13 && !seen.has(digitsOnly)) {
        seen.add(digitsOnly);
        results.push({ number: normalized, country: 'CZ' });
      }
    }
  }
  return results;
}

// ============================================================
// PHONE EXTRACTION - EU FALLBACK
// ============================================================

function extractEUPhones(text, alreadyFound) {
  const results = [];
  const seen = new Set(alreadyFound.map(p => p.number.replace(/\D/g, '')));
  
  // EU country codes
  const euCodes = {
    '43': 'AT', '32': 'BE', '359': 'BG', '385': 'HR', '357': 'CY',
    '45': 'DK', '372': 'EE', '358': 'FI', '33': 'FR', '49': 'DE',
    '30': 'GR', '353': 'IE', '39': 'IT', '371': 'LV', '370': 'LT',
    '352': 'LU', '356': 'MT', '31': 'NL', '48': 'PL', '351': 'PT',
    '40': 'RO', '386': 'SI', '34': 'ES', '46': 'SE'
  };
  
  // Generic EU phone pattern: +XX or +XXX followed by 6-12 digits
  const euPattern = /\+(\d{2,3})[\s.-]?(\d[\d\s.-]{5,14}\d)/g;
  
  let match;
  while ((match = euPattern.exec(text)) !== null) {
    const countryCode = match[1];
    const countryName = euCodes[countryCode];
    
    if (countryName) {
      const fullNumber = `+${countryCode} ${match[2].replace(/[\s.-]+/g, ' ').trim()}`;
      const digitsOnly = fullNumber.replace(/\D/g, '');
      
      if (digitsOnly.length >= 9 && digitsOnly.length <= 15 && !seen.has(digitsOnly)) {
        seen.add(digitsOnly);
        results.push({ number: fullNumber, country: countryName });
      }
    }
  }
  
  // Also try 00XX format
  const eu00Pattern = /00(\d{2,3})[\s.-]?(\d[\d\s.-]{5,14}\d)/g;
  while ((match = eu00Pattern.exec(text)) !== null) {
    const countryCode = match[1];
    const countryName = euCodes[countryCode];
    
    if (countryName) {
      const fullNumber = `+${countryCode} ${match[2].replace(/[\s.-]+/g, ' ').trim()}`;
      const digitsOnly = fullNumber.replace(/\D/g, '');
      
      if (digitsOnly.length >= 9 && digitsOnly.length <= 15 && !seen.has(digitsOnly)) {
        seen.add(digitsOnly);
        results.push({ number: fullNumber, country: countryName });
      }
    }
  }
  
  return results;
}

// ============================================================
// EXTRACT ALL PHONES
// ============================================================

function extractAllPhones(text) {
  const cleaned = preprocessContent(text);
  
  // Priority extraction: HU, SK, CZ
  const huPhones = extractHungarianPhones(cleaned);
  const skPhones = extractSlovakPhones(cleaned);
  const czPhones = extractCzechPhones(cleaned);
  
  const priorityPhones = [...huPhones, ...skPhones, ...czPhones];
  
  // Fallback: other EU phones
  const euPhones = extractEUPhones(cleaned, priorityPhones);
  
  return {
    all: [...priorityPhones, ...euPhones],
    hu: huPhones,
    sk: skPhones,
    cz: czPhones,
    eu: euPhones
  };
}

// ============================================================
// EMAIL EXTRACTION
// ============================================================

function extractEmails(text) {
  const results = [];
  const seen = new Set();
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  
  let match;
  while ((match = emailRegex.exec(text)) !== null) {
    const email = match[0].toLowerCase();
    
    if (seen.has(email)) continue;
    if (email.includes('example.com')) continue;
    if (email.includes('domain.com')) continue;
    if (email.includes('sentry.io')) continue;
    if (email.includes('wixpress.com')) continue;
    if (email.includes('email.com') && email.startsWith('your')) continue;
    if (/\d{6,}/.test(email)) continue;
    if (email.endsWith('.png') || email.endsWith('.jpg') || email.endsWith('.svg')) continue;
    
    seen.add(email);
    results.push(email);
  }
  return results;
}

// ============================================================
// CONTACT PAGE DETECTION
// ============================================================

const contactPagePatterns = [
  /contact/i, /get.?in.?touch/i, /reach.?us/i, /write.?us/i, /talk.?to.?us/i,
  /kontakt/i, /napíšte.?nám/i, /spojte.?sa/i, /kontaktujte/i,
  /napište.?nám/i, /spojte.?se/i,
  /kapcsolat/i, /elérhetőség/i, /írjon.?nekünk/i, /keressen.?minket/i,
  /about.?us/i, /impressum/i, /rólunk/i, /o.?nás/i
];

function extractLinks(markdown, baseUrl) {
  if (!markdown) return [];
  
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = [];
  const seenUrls = new Set();
  let match;
  
  while ((match = linkRegex.exec(markdown)) !== null) {
    const rawUrl = match[2];
    const cleanedUrl = cleanUrl(rawUrl, baseUrl);
    
    if (seenUrls.has(cleanedUrl)) continue;
    seenUrls.add(cleanedUrl);
    
    links.push({ text: match[1], url: cleanedUrl });
  }
  
  return links;
}

function scoreLink(link) {
  let score = 0;
  const reasons = [];
  const textAndUrl = `${link.text || ''} ${link.url || ''}`.toLowerCase();
  
  for (const pattern of contactPagePatterns) {
    if (pattern.test(textAndUrl)) {
      score += 10;
      reasons.push(`Pattern: ${pattern.source}`);
      break;
    }
  }
  
  const urlPath = (link.url || '').toLowerCase();
  if (/\/(contact|kontakt|kapcsolat|elérhetőség|elerhetoseg|impressum)/i.test(urlPath)) {
    score += 15;
    reasons.push('URL path match');
  }
  
  return { link, score, reasons };
}

function findContactLinks(markdown, baseUrl) {
  const allLinks = extractLinks(markdown, baseUrl);
  return allLinks
    .map(link => scoreLink(link))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ============================================================
// HTML TO MARKDOWN CONVERSION
// ============================================================

async function getPageMarkdown(page, fullPage = false) {
  return await page.evaluate((fullPage) => {
    function htmlToMarkdown(element) {
      let md = '';
      
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          md += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = node.tagName.toLowerCase();
          
          const style = window.getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          if (['script', 'style', 'noscript', 'iframe', 'svg'].includes(tag)) continue;
          
          switch (tag) {
            case 'h1': md += `\n# ${htmlToMarkdown(node)}\n`; break;
            case 'h2': md += `\n## ${htmlToMarkdown(node)}\n`; break;
            case 'h3': md += `\n### ${htmlToMarkdown(node)}\n`; break;
            case 'h4': md += `\n#### ${htmlToMarkdown(node)}\n`; break;
            case 'h5': md += `\n##### ${htmlToMarkdown(node)}\n`; break;
            case 'h6': md += `\n###### ${htmlToMarkdown(node)}\n`; break;
            case 'p': md += `\n${htmlToMarkdown(node)}\n`; break;
            case 'br': md += '\n'; break;
            case 'hr': md += '\n---\n'; break;
            case 'strong':
            case 'b': md += `**${htmlToMarkdown(node)}**`; break;
            case 'em':
            case 'i': md += `*${htmlToMarkdown(node)}*`; break;
            case 'a':
              const href = node.getAttribute('href');
              const text = htmlToMarkdown(node).trim();
              if (href && text) {
                md += `[${text}](${href})`;
              } else if (href) {
                md += `[${href}](${href})`;
              } else {
                md += text;
              }
              break;
            case 'img':
              const alt = node.getAttribute('alt') || '';
              const src = node.getAttribute('src') || '';
              if (src) md += `![${alt}](${src})`;
              break;
            case 'ul':
              md += '\n';
              for (const li of node.querySelectorAll(':scope > li')) {
                md += `- ${htmlToMarkdown(li).trim()}\n`;
              }
              break;
            case 'ol':
              md += '\n';
              let i = 1;
              for (const li of node.querySelectorAll(':scope > li')) {
                md += `${i++}. ${htmlToMarkdown(li).trim()}\n`;
              }
              break;
            case 'li': md += htmlToMarkdown(node); break;
            case 'blockquote': md += `\n> ${htmlToMarkdown(node).trim()}\n`; break;
            case 'code': md += `\`${node.textContent}\``; break;
            case 'pre': md += `\n\`\`\`\n${node.textContent}\n\`\`\`\n`; break;
            case 'table':
              md += '\n';
              const rows = node.querySelectorAll('tr');
              rows.forEach((row, idx) => {
                const cells = row.querySelectorAll('th, td');
                const cellTexts = Array.from(cells).map(c => c.textContent.trim());
                md += '| ' + cellTexts.join(' | ') + ' |\n';
                if (idx === 0) {
                  md += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
                }
              });
              break;
            default:
              md += htmlToMarkdown(node);
          }
        }
      }
      return md;
    }
    
    // For contact mode: scrape full body including header/footer
    // For content mode: try to find main content area
    let target;
    if (fullPage) {
      target = document.body;
    } else {
      target = document.querySelector('main, article, [role="main"], .content, #content') || document.body;
    }
    
    let markdown = htmlToMarkdown(target);
    
    markdown = markdown
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n +/g, '\n')
      .trim();
    
    return markdown;
  }, fullPage);
}

// ============================================================
// SCRAPE URL
// ============================================================

async function scrapePage(url, fullPage = false) {
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const markdown = await getPageMarkdown(page, fullPage);
    
    return { url, markdown, success: true };
  } catch (e) {
    return { url, markdown: '', success: false, error: e.message };
  } finally {
    await page.close();
  }
}

// ============================================================
// CONTACT MODE - MAIN LOGIC
// ============================================================

async function handleContactMode(urls) {
  const results = [];
  
  for (const url of urls) {
    const pageData = await scrapePage(url, true);  // fullPage = true for contacts
    
    if (!pageData.success) {
      results.push({
        url,
        success: false,
        error: pageData.error,
        emails: '',
        phones: '',
        depth: 0
      });
      continue;
    }
    
    const baseUrl = getBaseUrl(url);
    const phones = extractAllPhones(pageData.markdown);
    const emails = extractEmails(pageData.markdown);
    
    // Check if we found contacts
    const hasContacts = emails.length > 0 || phones.all.length > 0;
    
    if (hasContacts) {
      // Found on main page
      results.push({
        url,
        success: true,
        emails: emails.join('; '),
        phones: phones.all.map(p => p.number).join('; '),
        phonesDetailed: phones,
        countEmails: emails.length,
        countPhones: phones.all.length,
        depth: 0,
        source: 'main_page'
      });
    } else {
      // Try to find contact page
      const contactLinks = findContactLinks(pageData.markdown, baseUrl);
      
      if (contactLinks.length > 0) {
        const bestContactUrl = contactLinks[0].link.url;
        
        // Scrape contact page
        const contactPageData = await scrapePage(bestContactUrl, true);
        
        if (contactPageData.success) {
          const deepPhones = extractAllPhones(contactPageData.markdown);
          const deepEmails = extractEmails(contactPageData.markdown);
          
          results.push({
            url,
            success: true,
            emails: deepEmails.join('; '),
            phones: deepPhones.all.map(p => p.number).join('; '),
            phonesDetailed: deepPhones,
            countEmails: deepEmails.length,
            countPhones: deepPhones.all.length,
            depth: 1,
            source: 'contact_page',
            contactPageUrl: bestContactUrl,
            contactPageScore: contactLinks[0].score
          });
        } else {
          results.push({
            url,
            success: true,
            emails: '',
            phones: '',
            countEmails: 0,
            countPhones: 0,
            depth: 1,
            source: 'contact_page_failed',
            contactPageUrl: bestContactUrl,
            error: contactPageData.error
          });
        }
      } else {
        // No contact page found
        results.push({
          url,
          success: true,
          emails: '',
          phones: '',
          countEmails: 0,
          countPhones: 0,
          depth: 0,
          source: 'no_contacts_found'
        });
      }
    }
    
    // Delay between URLs
    await new Promise(r => setTimeout(r, 500));
  }
  
  return results;
}

// ============================================================
// CONTENT MODE - MAIN LOGIC
// ============================================================

async function handleContentMode(urls) {
  const results = [];
  
  for (const url of urls) {
    const pageData = await scrapePage(url);
    
    results.push({
      url,
      success: pageData.success,
      markdown: pageData.markdown,
      contentLength: pageData.markdown?.length || 0,
      error: pageData.error || null
    });
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  return results;
}

// ============================================================
// API ENDPOINTS
// ============================================================

// POST /scrape - Main endpoint, mode determined by header
app.post('/scrape', async (req, res) => {
  const { urls } = req.body;
  const mode = req.headers['x-mode'] || req.headers['mode'] || 'contact';
  
  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ error: 'Provide urls array in body' });
  }
  
  if (!['contact', 'content'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode. Use "contact" or "content"' });
  }
  
  console.log(`Processing ${urls.length} URLs in ${mode} mode`);
  
  try {
    const results = mode === 'contact' 
      ? await handleContactMode(urls)
      : await handleContentMode(urls);
    
    res.json({ mode, count: results.length, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', browserReady: !!browser, modes: ['contact', 'content'] });
});

// ============================================================
// START SERVER
// ============================================================

const PORT = 3333;
initBrowser().then(() => {
  app.listen(PORT, '172.17.0.1', () => {
    console.log(`Scraper API running on http://172.17.0.1:${PORT}`);
    console.log('Modes: contact (default), content');
    console.log('Set mode via header: x-mode or mode');
  });
});

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit();
});
