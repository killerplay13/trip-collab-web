/**
 * Formats a number with thousands separators.
 * Example: 1234567.5 -> 1,234,567.5
 */
export function formatAmount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num)) return "";

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formats a money amount with currency symbol and thousands separators.
 * Example: 1000, "TWD" -> NT$1,000
 */
export function formatMoney(value: number | string | null | undefined, currency: string = "TWD"): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num)) return "";

  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Parses a simple arithmetic expression into a number.
 * Supports +, -, *, /, and decimals.
 */
export function parseAmountExpression(expr: string | number | null | undefined): number {
  if (expr === null || expr === undefined || expr === "") return NaN;
  if (typeof expr === "number") return expr;
  
  let s = String(expr).replace(/\s+/g, "");
  if (s === "") return NaN;

  if (/[^0-9.+\-*/]/.test(s)) return NaN;

  if (s.startsWith("-")) s = "0" + s;
  if (s.startsWith("+")) s = "0" + s;

  const tokens = s.match(/([0-9.]+)|([+\-*/])/g);
  if (!tokens) return NaN;

  let t1: any[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '*' || tokens[i] === '/') {
      let prev = t1.pop();
      let op = tokens[i];
      let next = tokens[++i];
      if (prev === undefined || next === undefined) return NaN;
      let p = Number(prev);
      let n = Number(next);
      if (isNaN(p) || isNaN(n)) return NaN;
      if (op === '*') t1.push(p * n);
      else t1.push(p / n);
    } else {
      t1.push(tokens[i]);
    }
  }

  let total = Number(t1[0]);
  if (isNaN(total)) return NaN;
  for (let i = 1; i < t1.length; i += 2) {
    let op = t1[i];
    let next = Number(t1[i+1]);
    if (isNaN(next)) return NaN;
    if (op === '+') total += next;
    else if (op === '-') total -= next;
    else return NaN;
  }

  return total;
}
