-- P2 slice 2 (plan §11.5 adjudication): e5-small vector channel for the v3
-- unit plane. The P0.5 ablation cleared multilingual-e5-small with
-- hit@5 +16.9pp (CI95 [+10.4, +24.0]) over the MiniLM baseline.
--
-- unit_views_vec_e5 stores passage-prefixed e5 embeddings of unit body
-- views (384-dim, quantized ONNX, Xenova/multilingual-e5-small). The
-- projection is SHADOW-grade: it is rebuilt by the projection_outbox
-- worker and consumed only by UnitRecallReader (I4 rebuildable, I11
-- shadow-only). Channel activation is env-gated (MEMORY_READ_V3_VECTOR).

CREATE VIRTUAL TABLE IF NOT EXISTS unit_views_vec_e5 USING vec0(
  view_id INTEGER PRIMARY KEY,
  embedding float[384]
);
