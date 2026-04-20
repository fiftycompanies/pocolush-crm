# E2E 픽스처 — 결과물 사진 (P1-b)

## 현재 상태 (Phase 1)

모든 `.jpg` 파일은 **1x1 픽셀 플레이스홀더** JPEG (~125B).
업로드 플로우(SP-01/02/03/04)만 검증 가능.

## Phase 2b 이전 교체 필요

SP-09 리사이즈 회귀 검증을 위해 **실제 크기** JPEG로 교체:

| 파일 | 요구 해상도 | 용도 |
|---|---|---|
| `small-landscape.jpg` | 800x600 (5~15KB) | SP-01/02/05 정상 업로드 |
| `small-portrait.jpg` | 600x800 (5~15KB) | SP-05/06 정렬 검증 |
| `tiny.jpg` | 100x100 (~2KB) | SP-03 최소 크기 |
| `huge.jpg` | **4000x3000 (~500KB)** | **SP-09 리사이즈 회귀 (<500KB + 원본 50% 압축 검증)** |
| `non-image.txt` | (텍스트) | SP-12 rejection |

## 생성 예시 (macOS `sips` 또는 Python PIL)

```bash
# sips (macOS 내장)
sips -z 600 800 --setProperty format jpeg input.jpg --out small-landscape.jpg
sips -z 3000 4000 --setProperty format jpeg input.jpg --out huge.jpg

# Python PIL
python3 -c "
from PIL import Image
import numpy as np
img = Image.fromarray((np.random.rand(3000, 4000, 3) * 255).astype('uint8'))
img.save('huge.jpg', 'JPEG', quality=90)
"
```

## 주의
- `.gitattributes`에 `*.jpg binary` 설정됨 (diff 억제)
- 저작권 있는 이미지 절대 커밋 금지 — 랜덤 생성 or CC0만 사용
