require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { initDb, getPool } = require('./index');

const posts = [
  {
    slug: '7-chien-luoc-tang-traffic-organic',
    tag: 'SEO',
    tag_color: 'bg-blue-100 text-blue-700',
    title: '7 Chiến Lược Tăng Traffic Organic Bền Vững Năm 2025',
    excerpt: 'Khám phá những phương pháp hiệu quả nhất để tăng lượt truy cập tự nhiên từ Google mà không vi phạm chính sách Webmaster.',
    author: 'Nguyễn Minh',
    read_time: '8 phút đọc',
    gradient: 'from-blue-500 to-blue-700',
    cover: '/blog_1.png',
    content: `
## Giới thiệu

Traffic organic (tự nhiên) là nguồn traffic quý giá nhất cho mọi website. Khác với traffic trả phí, traffic organic mang lại lượng truy cập bền vững, chi phí thấp và tỷ lệ chuyển đổi cao hơn.

Trong bài viết này, chúng tôi sẽ chia sẻ **7 chiến lược** đã được kiểm chứng để tăng traffic organic một cách bền vững trong năm 2025.

## 1. Tối ưu hóa On-Page SEO

On-Page SEO là nền tảng của mọi chiến lược tăng traffic organic. Đảm bảo rằng:

- **Title tag** chứa từ khóa chính và dưới 60 ký tự
- **Meta description** hấp dẫn, chứa từ khóa và dưới 160 ký tự
- **Heading (H1-H6)** sử dụng từ khóa một cách tự nhiên
- **Internal linking** hợp lý để phân phối link juice
- **URL** ngắn gọn, chứa từ khóa chính

## 2. Content Marketing chất lượng cao

Nội dung vẫn là "vua" trong SEO. Để tạo nội dung chất lượng:

- Nghiên cứu từ khóa kỹ lưỡng với công cụ như Ahrefs, SEMrush
- Viết bài dài, chi tiết (2,000+ từ) cho các chủ đề quan trọng
- Sử dụng hình ảnh, video, infographic minh họa
- Cập nhật nội dung cũ thường xuyên
- Tạo content hub xung quanh các chủ đề chính

## 3. Technical SEO

Các yếu tố kỹ thuật ảnh hưởng trực tiếp đến thứ hạng:

- **Core Web Vitals**: LCP < 2.5s, FID < 100ms, CLS < 0.1
- **Mobile-first indexing**: Website phải responsive hoàn hảo
- **Site speed**: Tối ưu hình ảnh, sử dụng CDN, lazy loading
- **Schema markup**: Giúp Google hiểu nội dung tốt hơn
- **XML Sitemap & Robots.txt**: Cấu hình đúng cách

## 4. Xây dựng Backlink chất lượng

Backlink vẫn là yếu tố xếp hạng quan trọng nhất:

- Guest posting trên các website uy tín trong ngành
- Tạo nội dung có giá trị cao để thu hút backlink tự nhiên
- Digital PR và media outreach
- Broken link building
- Tham gia cộng đồng và diễn đàn chuyên ngành

## 5. Tối ưu User Experience (UX)

Google ngày càng chú trọng trải nghiệm người dùng:

- Thiết kế giao diện trực quan, dễ sử dụng
- Giảm bounce rate bằng nội dung hấp dẫn
- Tăng time on page với multimedia content
- Tối ưu navigation và site structure
- A/B testing liên tục để cải thiện

## 6. Local SEO

Nếu bạn có doanh nghiệp địa phương:

- Tối ưu Google Business Profile
- Thu thập đánh giá từ khách hàng
- Tạo nội dung địa phương (local content)
- Đăng ký trên các website yellow pages Việt Nam
- Sử dụng schema LocalBusiness

## 7. Theo dõi và phân tích dữ liệu

Không thể cải thiện những gì không đo lường được:

- Sử dụng Google Analytics 4 để theo dõi traffic
- Google Search Console để phân tích hiệu suất tìm kiếm
- Theo dõi keyword rankings hàng tuần
- Phân tích đối thủ cạnh tranh
- Điều chỉnh chiến lược dựa trên dữ liệu thực tế

## Kết luận

Tăng traffic organic là một quá trình dài hạn, đòi hỏi sự kiên nhẫn và nhất quán. Bằng cách áp dụng 7 chiến lược trên, website của bạn sẽ từng bước cải thiện thứ hạng và thu hút lượng truy cập tự nhiên bền vững.

> **Lưu ý**: Kết hợp với dịch vụ traffic user thật từ Traffic68 sẽ giúp tăng tốc quá trình cải thiện SEO đáng kể.
    `,
  },
  {
    slug: 'so-sanh-traffic-user-that-vs-bot',
    tag: 'Traffic',
    tag_color: 'bg-orange-100 text-orange-700',
    title: 'So Sánh Traffic User Thật vs Bot: Tại Sao Sự Khác Biệt Quan Trọng?',
    excerpt: 'Phân tích chuyên sâu về sự khác biệt giữa traffic user thật và bot, và ảnh hưởng của chúng đến SEO và Google Analytics.',
    author: 'Trần Lan',
    read_time: '6 phút đọc',
    gradient: 'from-orange-400 to-orange-600',
    cover: '/blog_2.png',
    content: `
## Traffic User Thật là gì?

Traffic user thật là lượt truy cập đến từ **người dùng thực tế**, sử dụng thiết bị thật (desktop, mobile, tablet) với hành vi tự nhiên như đọc bài, scroll, click link, và tương tác với nội dung.

### Đặc điểm nhận biết traffic user thật:
- Thời gian trên trang (Time on Page) hợp lý: 1-5 phút
- Bounce rate tự nhiên: 40-60%
- Nhiều pageviews per session
- Hành vi scroll, click tự nhiên
- Đến từ nhiều nguồn khác nhau (organic, social, direct)

## Traffic Bot là gì?

Traffic bot là lượt truy cập được tạo ra bởi **phần mềm tự động** (bot), không phải người thật. Bot có thể mô phỏng hành vi cơ bản nhưng thường thiếu sự tự nhiên.

### Dấu hiệu nhận biết traffic bot:
- Time on Page cực ngắn (dưới 5 giây)
- Bounce rate cao bất thường (95-100%)
- Không có tương tác (không scroll, không click)
- Traffic đột biến bất thường
- Đến từ IP giống nhau hoặc datacenter

## Ảnh hưởng đến SEO

### Traffic User Thật giúp:
- ✅ Tăng CTR tự nhiên trên Google SERP
- ✅ Giảm bounce rate → Tín hiệu tích cực cho Google
- ✅ Tăng time on page → Cải thiện user engagement
- ✅ Tạo tín hiệu social proof tự nhiên
- ✅ An toàn tuyệt đối với Google Algorithm

### Traffic Bot gây:
- ❌ Google penalty nếu bị phát hiện
- ❌ Méo dữ liệu Google Analytics
- ❌ Không tạo chuyển đổi thực tế
- ❌ Lãng phí ngân sách quảng cáo
- ❌ Có thể bị de-index website

## Cách Google phát hiện traffic bot

Google sử dụng nhiều phương pháp tinh vi:

1. **Browser fingerprinting**: Kiểm tra thông tin trình duyệt
2. **Behavior analysis**: Phân tích hành vi click, scroll
3. **IP analysis**: Phát hiện traffic từ datacenter
4. **JavaScript execution**: Bot thường không execute JS
5. **Machine learning**: Mô hình AI phát hiện anomaly

## Tại sao chọn Traffic User Thật?

Đầu tư vào traffic user thật là quyết định thông minh vì:

- **An toàn SEO**: Không vi phạm chính sách Google
- **ROI cao hơn**: Traffic chất lượng → Chuyển đổi thực tế
- **Dữ liệu chính xác**: Phân tích đúng hành vi khách hàng
- **Bền vững**: Không lo bị penalty hay mất traffic đột ngột

## Kết luận

Sự khác biệt giữa traffic user thật và bot không chỉ là về số lượng, mà còn về **chất lượng và an toàn**. Hãy luôn ưu tiên traffic từ người dùng thật để xây dựng website bền vững.
    `,
  },
];

async function seedBlog() {
  try {
    await initDb();
    const pool = getPool();

    console.log('🌱 Seeding blog posts...');

    for (const post of posts) {
      const [existing] = await pool.execute(
        'SELECT id FROM blog_posts WHERE slug = ?',
        [post.slug]
      );

      if (existing.length > 0) {
        console.log(`⏭️  Skipping "${post.title}" (already exists)`);
        continue;
      }

      await pool.execute(
        `INSERT INTO blog_posts
         (slug, title, excerpt, content, cover, tag, tag_color, author, read_time, gradient, status, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', NOW())`,
        [
          post.slug,
          post.title,
          post.excerpt,
          post.content,
          post.cover,
          post.tag,
          post.tag_color,
          post.author,
          post.read_time,
          post.gradient,
        ]
      );

      console.log(`✅ Created: "${post.title}"`);
    }

    console.log('✨ Blog seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding blog:', error);
    process.exit(1);
  }
}

seedBlog();
