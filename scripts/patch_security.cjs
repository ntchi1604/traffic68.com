"use strict";
const fs = require('fs');
let c = fs.readFileSync('src/pages/Admin/AdminSecurity.jsx', 'utf8');

// IIFE closing sequence
const iife = c.lastIndexOf('      })()}');
// Last first-occurrence of modal block  
const lastModal = c.lastIndexOf('{modal && <TaskModal');

console.log('Last IIFE end at:', iife);
console.log('Last modal at:', lastModal);

if (iife > 0 && lastModal > iife) {
  // Keep before iife end, then skip to last modal block
  const before = c.substring(0, iife + 12); // include '      })()}\r\n'
  const rest = c.substring(lastModal);
  c = before + '\r\n      ' + rest;
  fs.writeFileSync('src/pages/Admin/AdminSecurity.jsx', c, 'utf8');
  console.log('Done! Length:', c.length);
} else {
  console.log('Not found as expected, trying other approach');
  // Find first modal after IIFE area
  const firstModal = c.indexOf('{modal && <TaskModal');
  console.log('First modal:', firstModal);
}
