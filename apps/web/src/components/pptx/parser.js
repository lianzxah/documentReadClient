import matter from 'gray-matter'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt()

export function parseMarkdownToPptxJson(markdown) {
  if (!markdown) return { slides: [] }

  const cleaned = markdown
    .trim()
    .replace(/^```(?:slidev|markdown|md)?\s*\n/, '')
    .replace(/\n```\s*$/, '')
    .trim()

  // Slidev splits slides by "---"
  const rawSlides = cleaned.split(/\n---\n+/).filter(Boolean)

  const slides = rawSlides.map((rawSlide, index) => {
    // gray-matter expects frontmatter at the top
    let contentToParse = rawSlide
    // If it doesn't start with ---, but has frontmatter-like format, we might need to add ---
    // Actually, gray-matter works best if we wrap it
    if (!contentToParse.startsWith('---') && contentToParse.includes(': ')) {
      // It might not be frontmatter, let's just parse it as is with matter
      contentToParse = '---\n' + contentToParse
    }

    let parsed
    try {
      parsed = matter(contentToParse)
    } catch (e) {
      parsed = { data: {}, content: rawSlide }
    }

    const { data: frontmatter, content } = parsed
    const tokens = md.parse(content || '', {})

    const elements = []
    let currentY = 0.5

    // A very simple rule-based token to element conversion
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (token.type === 'heading_open') {
        const nextToken = tokens[i + 1]
        if (nextToken && nextToken.type === 'inline') {
          const isH1 = token.tag === 'h1'
          elements.push({
            id: `el-${index}-${i}`,
            type: 'text',
            content: nextToken.content,
            left: 50,
            top: currentY * 100,
            width: 900,
            height: (isH1 ? 1.5 : 1) * 100,
            color: '#333333',
            fontSize: isH1 ? 44 : 32,
            fontWeight: 'bold',
            align: frontmatter.layout === 'cover' ? 'center' : 'left',
          })
          currentY += isH1 ? 1.5 : 1.2
        }
      } else if (token.type === 'paragraph_open') {
        const nextToken = tokens[i + 1]
        if (nextToken && nextToken.type === 'inline') {
          // Check for images
          const imgToken = nextToken.children?.find((c) => c.type === 'image')
          if (imgToken) {
            elements.push({
              id: `el-${index}-${i}`,
              type: 'image',
              src: imgToken.attrGet('src'),
              left: 100,
              top: currentY * 100,
              width: 800,
              height: 450,
            })
            currentY += 5
          } else {
            elements.push({
              id: `el-${index}-${i}`,
              type: 'text',
              content: nextToken.content,
              left: 50,
              top: currentY * 100,
              width: 900,
              height: 100,
              color: '#666666',
              fontSize: 18,
              fontWeight: 'normal',
              align: 'left',
            })
            currentY += 1.2
          }
        }
      } else if (token.type === 'bullet_list_open') {
        // Collect list items
        let listContent = ''
        while (i < tokens.length && tokens[i].type !== 'bullet_list_close') {
          if (tokens[i].type === 'inline') {
            listContent += '• ' + tokens[i].content + '\n'
          }
          i++
        }
        elements.push({
          id: `el-${index}-${i}`,
          type: 'text',
          content: listContent.trim(),
          left: 50,
          top: currentY * 100,
          width: 900,
          height: 300,
          color: '#555555',
          fontSize: 20,
          fontWeight: 'normal',
          align: 'left',
        })
        currentY += 3.5
      }
    }

    return {
      id: `slide-${index}`,
      background: {
        type: 'solid',
        color: frontmatter.layout === 'cover' ? '#f0f4f8' : '#ffffff',
      },
      elements,
    }
  })

  return {
    width: 1000,
    height: 562.5,
    slides,
  }
}
