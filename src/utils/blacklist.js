const RACIAL_SLURS = [
  /n[i1!|]gg[e3a@4][r]s?/gi,
  /n[i1!|]gg[e3a@4]h?s?/gi,
  /n[i1!|]g{2,}[e3a@4]r?s?/gi,
  /n[e3][g]{2,}[r]/gi,
  /n[i1!|][g]{2,}[a@4]/gi,
  /n[i1!|][g]{2,}[u]/gi,
  /n[e3][g]{2,}[o0]/gi,
  /n[i1!|]bb[a@4]/gi,
  /n[i1!|]pp[a@4]/gi,
  /n[i1!|]cc[a@4]/gi,
  /n[i1!|]dd[a@4]/gi,
  /n[i1!|]ff[a@4]/gi,
  /n[i1!|]kk[a@4]/gi,
  /n[i1!|]mm[a@4]/gi,
  /n[i1!|]pp[a@4]/gi,
  /n[i1!|]qq[a@4]/gi,
  /n[i1!|]rr[a@4]/gi,
  /n[i1!|]ss[a@4]/gi,
  /n[i1!|]tt[a@4]/gi,
  /n[i1!|]vv[a@4]/gi,
  /n[i1!|]ww[a@4]/gi,
  /n[i1!|]xx[a@4]/gi,
  /n[i1!|]yy[a@4]/gi,
  /n[i1!|]zz[a@4]/gi,
  
  /ch[i1!|]nk/gi,
  /g[o0][o0]k/gi,
  /sp[i1!|]ck?/gi,
  /w[e3]tb[a@4]ck/gi,
  /b[e3][a@4]n[e3]r/gi,
  /t[o0]w[e3]lh[e3][a@4]d/gi,
  /s[a@4]nd n[i1!|]gg[e3a@4]r/gi,
  /r[a@4]gh[e3][a@4]d/gi,
  /h[a@4]jj[i1!|]/gi,
  /t[e3]rr[o0]r[i1!|]st/gi,
  /k[i1!|]k[e3]/gi,
  /wh[i1!|]t[e3] p[o0]w[e3]r/gi,
  /14 ?88/gi,
  /h[e3][i1!|]l h[i1!|]tl[e3]r/gi,
];

const HOMOPHOBIC_SLURS = [
  /f[a@4]gg[o0]ts?/gi,
  /f[a@4]g{2,}[o0]ts?/gi,
  /f[a@4][g]{2,}[i1!|]t/gi,
  /f[a@4][g]{2,}[e3]t/gi,
  /f[a@4][g]{2,}[a@4]t/gi,
  /f[a@4][g]{2,}[u]t/gi,
  /f[a@4][g]{2,}[y]/gi,
  /f[a@4]bb[o0]t/gi,
  /f[a@4]cc[o0]t/gi,
  /f[a@4]dd[o0]t/gi,
  /f[a@4]ff[o0]t/gi,
  /f[a@4]hh[o0]t/gi,
  /f[a@4]jj[o0]t/gi,
  /f[a@4]kk[o0]t/gi,
  /f[a@4]ll[o0]t/gi,
  /f[a@4]mm[o0]t/gi,
  /f[a@4]nn[o0]t/gi,
  /f[a@4]pp[o0]t/gi,
  /f[a@4]qq[o0]t/gi,
  /f[a@4]rr[o0]t/gi,
  /f[a@4]ss[o0]t/gi,
  /f[a@4]tt[o0]t/gi,
  /f[a@4]vv[o0]t/gi,
  /f[a@4]ww[o0]t/gi,
  /f[a@4]xx[o0]t/gi,
  /f[a@4]yy[o0]t/gi,
  /f[a@4]zz[o0]t/gi,
  
  /qu[e3]{2,}r/gi,
  /d[y]k[e3]/gi,
  /tr[a@4]nn[y]/gi,
  /tr[a@4]p/gi,
  /s[i1!|]ss[y]/gi,
  /g[a@4][y]/gi,
  /h[o0]m[o0]/gi,
  /l[e3]sb[o0]/gi,
];

const OFFENSIVE_TERMS = [
  /r[e3]t[a@4]rd[e3]?d?/gi,
  /r[e3]t[a@4]rd/gi,
  /[a@4]ut[i1!|]st[i1!|]c/gi,
  /sp[a@4]st[i1!|]c/gi,
  /cr[i1!|]ppl[e3]/gi,
  /m[o0]ng[o0]l[o0][i1!|]d/gi,
  /d[o0]wn[i1!|][e3]/gi,
  /b[i1!|]tch/gi,
  /wh[o0]r[e3]/gi,
  /sl[u]t/gi,
  /c[u]nt/gi,
  /th[o0]t/gi,
  /k[y]s/gi,
  /k[i1!|]ll y[o0]urs[e3]lf/gi,
  /n[e3]ck y[o0]urs[e3]lf/gi,
  /h[a@4]ng y[o0]urs[e3]lf/gi,
  /d[i1!|][e3]/gi,
  /su[i1!|]c[i1!|]d[e3]/gi,
];

const HATE_SYMBOLS = [
  /1488/g,
  /14\/88/g,
  /88/g,
  /卍/g,
  /卐/g,
  /h[e3][i1!|]l h[i1!|]tl[e3]r/gi,
  /s[i1!|][e3]g h[e3][i1!|]l/gi,
  /wh[i1!|]t[e3] pr[i1!|]d[e3]/gi,
  /wh[i1!|]t[e3] p[o0]w[e3]r/gi,
  /bl[a@4]ck l[i1!|]v[e3]s d[o0]nt m[a@4]tt[e3]r/gi,
  /[a@4]ll l[i1!|]v[e3]s m[a@4]tt[e3]r/gi,
];
export const ALL_BLACKLISTED_PATTERNS = [
  ...RACIAL_SLURS,
  ...HOMOPHOBIC_SLURS,
  ...OFFENSIVE_TERMS,
  ...HATE_SYMBOLS
];

export function containsBlacklistedContent(text) {
  if (!text || typeof text !== 'string') return { isBlacklisted: false };
  
  const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const originalText = text.toLowerCase();
  
  for (const pattern of ALL_BLACKLISTED_PATTERNS) {
    if (pattern.test(originalText) || pattern.test(cleanText)) {
      return {
        isBlacklisted: true,
        reason: 'Contains prohibited language',
        pattern: pattern.source
      };
    }
  }
  
  return { isBlacklisted: false };
}

export function getContentSeverity(text) {
  const result = containsBlacklistedContent(text);
  if (!result.isBlacklisted) return 'clean';
  
  const cleanText = text.toLowerCase();
  
  for (const pattern of [...RACIAL_SLURS, ...HOMOPHOBIC_SLURS]) {
    if (pattern.test(cleanText)) return 'severe';
  }
  
  for (const pattern of HATE_SYMBOLS) {
    if (pattern.test(cleanText)) return 'severe';
  }
  
  for (const pattern of OFFENSIVE_TERMS) {
    if (pattern.test(cleanText)) return 'moderate';
  }
  
  return 'mild';
}
export {
  RACIAL_SLURS,
  HOMOPHOBIC_SLURS,
  OFFENSIVE_TERMS,
  HATE_SYMBOLS
};
