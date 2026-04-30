#!/usr/bin/env node
/**
 * Standalone test for the parseAIJson cascade.
 * Run with:  pnpm tsx scripts/test-json-cleaner.mjs
 */

import { parseAIJson } from '../lib/ai/orchestrator/utils/json-cleaner.ts';

const samples = [
  {
    name: 'ERROR_HANDLER with embedded XML (apostrophe quotes)',
    raw: '```json\n' + JSON.stringify({
      exceptionSubprocesses: [{
        id: 'ESP-01',
        name: 'Validation Failure Handler',
        scope: 'global',
        steps: [{
          type: 'Script',
          name: 'Capture Exception',
          config: {
            scriptLanguage: 'Groovy',
            description: "Captures exception.getClass().getName(), exception.getMessage()",
          }
        }],
        errorPayload: "<?xml version='1.0' encoding='UTF-8'?>\n<error>\n  <code>VALIDATION</code>\n</error>"
      }]
    }, null, 2) + '\n```',
    validate: (o) => Array.isArray(o.exceptionSubprocesses) && o.exceptionSubprocesses.length === 1,
  },
  {
    name: 'SCRIPT with embedded Groovy (already valid JSON-escaped)',
    raw: JSON.stringify({
      files: [{
        path: 'src/main/resources/script/PreValidationHeaderCapture.groovy',
        content: "import com.sap.gateway.ip.core.customdev.util.Message\n\ndef Message processData(Message message) {\n  def headers = message.getHeaders()\n  String msgId = headers.get('SapMessageId')\n  if (!msgId) msgId = headers.get('CamelMessageId') ?: 'UNKNOWN'\n  return message\n}",
      }]
    }),
    validate: (o) => Array.isArray(o.files) && o.files[0].path.endsWith('.groovy'),
  },
  {
    name: 'SCRIPT with UNESCAPED double-quotes inside content (state-machine recovery)',
    // Simulate model emitting raw double-quotes inside a string value
    raw: '{\n  "files": [{\n    "path": "x.groovy",\n    "content": "println "hello world"; def x = "abc"; return x"\n  }]\n}',
    validate: (o) => Array.isArray(o.files) && o.files[0].content.includes('hello world'),
  },
  {
    name: 'MAPPING with embedded XSL',
    raw: JSON.stringify({
      mappings: [{
        id: 'M-01',
        type: 'XSLT',
        content: '<?xml version="1.0"?>\n<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">\n  <xsl:template match="/Vendor"><Vendor><ID><xsl:value-of select="@id"/></ID></Vendor></xsl:template>\n</xsl:stylesheet>',
      }]
    }),
    validate: (o) => Array.isArray(o.mappings) && o.mappings[0].content.includes('xsl:stylesheet'),
  },
  {
    name: 'Already-valid JSON with prose preamble',
    raw: 'Here is the result:\n```json\n{"adapters": [{"role": "sender", "type": "SOAP"}]}\n```\n\nLet me know if you need more.',
    validate: (o) => Array.isArray(o.adapters) && o.adapters[0].type === 'SOAP',
  },
];

let pass = 0;
let fail = 0;
for (const s of samples) {
  try {
    const out = parseAIJson(s.raw);
    const ok = s.validate(out);
    if (ok) {
      console.log(`  ✓ ${s.name}`);
      pass++;
    } else {
      console.error(`  ✗ ${s.name}  (parsed but failed validation)`);
      console.error(`    parsed: ${JSON.stringify(out).slice(0, 200)}`);
      fail++;
    }
  } catch (err) {
    console.error(`  ✗ ${s.name}`);
    console.error(`    ${err.message.split('\n').slice(0, 6).join('\n    ')}`);
    fail++;
  }
}

console.log(`\n${pass} passed, ${fail} failed (${samples.length} total)`);
process.exit(fail === 0 ? 0 : 1);
