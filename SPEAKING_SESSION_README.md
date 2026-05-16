# Session Speaking Flow - Documentation

## Fitur Baru
Sistem session speaking yang mengambil pertanyaan IELTS dari database Supabase, bukan dari hardcoded data.

## Alur Kerja (User Flow)
1. User masuk ke `/session/[sessionId]`
2. Melihat **Intro Screen** dengan instruksi
3. Klik **"Start Speaking Now"**
4. Masuk ke **Part1Speaking Component**:
   - Lihat pertanyaan (slide-through format)
   - Klik **"Start Recording"** 
   - SpeechRecognition capture jawaban
   - Live transcription tampil real-time
   - Klik **"Stop Recording"** saat selesai
   - **Re-record** atau **Next** ke pertanyaan berikutnya
5. Setelah semua pertanyaan selesai → **Completion Screen**

## Struktur Database (Sudah Ada)

### Tabel `public.topics`
```sql
- id (uuid, primary key)
- part (int: 1, 2, atau 3)
- title (text) - e.g., "Your home town"
- prompt (text, optional) - context/cue card
- is_active (boolean)
- created_at (timestamptz)
```

### Tabel `public.topic_details`
```sql
- id (uuid, primary key)
- topic_id (uuid, foreign key ke topics)
- type (text: 'question' atau 'bullet')
- content (text) - actual question/bullet point
- order_index (int) - untuk sorting
- created_at (timestamptz)
```

## Cara Menggunakan

### 1. Fetch Topics Dari Database
```typescript
import { getRandomTopicsFromPart, getQuestionsFromTopic } from "@/lib/question-fetcher";

// Get 2 random topics dari Part 1
const topics = await getRandomTopicsFromPart(1, 2);

// Extract questions dari sebuah topic
const questions = getQuestionsFromTopic(topic);
// Output: ["What kind of place is it?", "What's the most interesting part?", ...]
```

### 2. Session Page URL Parameters
```
/session/[sessionId]?part=1&count=2
```
- `part` - IELTS Part (1, 2, atau 3). Default: 1
- `count` - Jumlah topics. Default: 2

### 3. Menambah Questions Baru (Via SQL)
```sql
-- 1. Insert topic
INSERT INTO topics (part, title, is_active) 
VALUES (1, 'Your work or studies', true);

-- 2. Insert questions untuk topic
INSERT INTO topic_details (topic_id, type, content, order_index)
VALUES 
  ('topic-uuid-here', 'question', 'What do you do?', 0),
  ('topic-uuid-here', 'question', 'How long have you been doing it?', 1),
  ('topic-uuid-here', 'question', 'What do you like about it?', 2);
```

## Architecture

### Components
- **session/page.tsx** - Main page, handles intro → speaking flow
- **Part1Speaking.tsx** - Reusable component untuk Part 1 speaking
- **lib/question-fetcher.ts** - Database queries untuk topics

### States
```
SessionPage:
  - intro: Show instructions, fetch topics
  - speaking: Show Part1Speaking component
  - complete: Show completion screen

Part1Speaking:
  - intro: Show current question
  - recording: Listening & recording audio
  - playing: Show recorded transcript, can re-record or next
```

## Fitur Yang Ada
✓ Fetch topics dari database  
✓ Multiple questions per topic (slide-through)  
✓ Speech Recognition (browser-based)  
✓ Live transcription  
✓ Previous/Next navigation  
✓ Re-record option  
✓ Timer  
✓ Completion screen  

## Fitur Untuk Development Berikutnya

### Part 2 Support
- Single cue card display
- Longer prep time (1 minute)
- Follow-up questions format

### Part 3 Support  
- Chatbot-style Q&A
- Discussion format

### Recording Storage
- Save audio blobs to Supabase Storage
- Save transcripts to database
- Link to session attempts table

### Scoring Integration
- Call LM Studio API untuk analyze responses
- Store scores in database
- Show feedback & insights

### Admin Interface
- CRUD operations untuk topics
- Bulk import dari Excel/CSV
- Preview questions sebelum publish

## Notes
- Menggunakan Web Speech API (browser-based, no server dependency)
- Transcription real-time di client-side
- Untuk offline transcription, bisa tambah @xenova/transformers (Whisper)
- RLS policies sudah setup di database untuk security
