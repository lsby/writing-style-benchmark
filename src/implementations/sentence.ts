export type 句子片段 = { 正文: string }

/** 按句号切分正文并保留紧随其后的闭合标点，返回非空句子列表。 */
export function 切分句子(正文: string): 句子片段[] {
  let 字符们 = [...正文]
  let 结果: 句子片段[] = []
  let 起点 = 0
  for (let 索引 = 0; 索引 < 字符们.length; 索引++) {
    let 字符 = 字符们[索引]
    if (字符 !== '。' && 字符 !== '.') continue
    if (字符 === '.') {
      // 连续英文点属于省略号；数字之间的点保留为小数点。
      if (字符们[索引 - 1] === '.' || 字符们[索引 + 1] === '.') continue
      if (/\d/u.test(字符们[索引 - 1] ?? '') && /\d/u.test(字符们[索引 + 1] ?? '')) continue
    }
    while (字符们[索引 + 1] === '。' || /[”’」』）】"']/u.test(字符们[索引 + 1] ?? '')) 索引++
    let 句子 = 字符们
      .slice(起点, 索引 + 1)
      .join('')
      .trim()
    if (句子.length > 0) 结果.push({ 正文: 句子 })
    起点 = 索引 + 1
  }
  let 末句 = 字符们.slice(起点).join('').trim()
  if (末句.length > 0) 结果.push({ 正文: 末句 })
  return 结果
}
