-- RAG 문서 저장 테이블 (챗봇 컨텍스트용)
CREATE TABLE IF NOT EXISTS public.rag_documents (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  content     text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- anon/service_role 모두 읽기 허용 (Edge Function에서 service_role 키로 읽음)
ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rag_documents"
  ON public.rag_documents
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert rag_documents"
  ON public.rag_documents
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update rag_documents"
  ON public.rag_documents
  FOR UPDATE
  USING (true);
