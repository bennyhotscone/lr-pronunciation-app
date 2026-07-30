Do not implement a model yet.

Inspect the completed MVP and write a technical design document for replacing experimental browser recognition with a free on-device pronunciation classifier.

Cover:
- provider interface
- audio preprocessing
- WebGPU and WebAssembly fallback
- model loading and caching
- constrained pair comparison
- possible output classes: L, R, tap-like, deleted consonant, inserted vowel, unclear
- Japanese and Thai feedback mapping
- privacy
- model-size and older-phone constraints
- training-data requirements
- evaluation metrics
- staged rollout

Do not claim a pretrained model can reliably perform these exact classifications unless the repository contains evidence.
