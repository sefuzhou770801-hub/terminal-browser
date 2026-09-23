const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/u;

// Width in monospace columns: CJK characters take two.
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) width += WIDE.test(char) ? 2 : 1;
  return width;
}
