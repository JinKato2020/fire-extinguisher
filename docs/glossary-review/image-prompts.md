# 用語集の図版作成記録

2026-11-06。imagegenスキルの内蔵ツールを使用。既存教材の画風を維持し、既存の教材画像は上書きせず、用語用の別画像として保存する。

## term_gas_parts

編集対象：assets/figures/ch6_f22.jpg

Edit the provided cutaway extinguisher diagram into a labeled glossary illustration. Preserve its physically corrected structure, realistic red cylinder and metal shading, white background, navy type, landscape1536x1024. Title replace with「ガス加圧式粉末の主な部品」. Remove all exam question text and ア・イ labels. Show SIX large readable labels with thin navy leader lines and precise endpoint dots, never crossing each other: 安全栓 points to yellow ring; 加圧用ガス容器 points to the small rounded cartridge at top right inside; サイホン管 points to thick central vertical tube; ガス導入管 points to separate thin RIGHT tube that starts at top cap and runs alongside cartridge, NEVER connects to bottom of cartridge; 粉上り防止用封板 points to wide round plate at bottom of thick CENTRAL siphon; 逆流防止装置 points to small fitting at very bottom of thin RIGHT gas tube. Keep powder fill unlabeled to avoid clutter. Arrange three labels on each side with ample spacing, all text >=40px. Keep gas cartridge bottom fully closed and round. Footer small「形状・配置は機種により異なる」. Do not change tube endpoints or geometry. Exactly these six labels, no extra arrows, no invented components.

## term_strain

編集対象：assets/figures/ch3_f23.jpg

Transform the provided shaded steel-bar educational illustration into a LONGITUDINAL STRAIN teaching image. Retain white background, navy Japanese text, restrained red highlights, realistic metallic material and landscape1536x1024. Title「ひずみ＝伸び÷元の長さ」. Replace side-by-side bars with two horizontal bars stacked, aligned at left ends. Top label「変形前」, bar length L indicated by navy double-headed dimension arrow that spans exactly both ends; label「元の長さ L」. Bottom label「変形後」, same bar visibly longer toward the RIGHT (exaggerated for clarity), small outward red FORCE arrows outside left and right ends. A dashed vertical line projects original top bar RIGHT end downward to lower bar; highlight only the short segment beyond that line in pale red, label with short dimension arrow「伸び ΔL」. Bottom full arrow can say「L＋ΔL」but avoid overlapping. Bottom pale blue box formula「ε＝ΔL / L」and clear example「100mmが0.2mm伸びる → ひずみ0.002（0.2%）」. Small note「変形を強調した模式図」. Critical lengths: lower bar must exceed top only on right, original reference dashed line consistent, ΔL is additional stretch not total length. No stress formulas, no sections S, no tiny type.

## term_hand_tools

新規作成。参照画像なし。

Create a Japanese technical study illustration matching a clean extinguisher textbook: opaque white background, navy large Japanese labels, realistic softly shaded steel and natural wood, faint pale-blue panel separators, landscape1536x1024. Title「工具の形と役割」. Two balanced panels. Left heading「プライヤ」; large realistic slip-joint pliers with visibly serrated short jaws, a slotted adjustable pivot joint and two separate red-coated handles. Tool slightly open, mechanically plausible, no pipe wrench or needle-nose substitution. Below text「部品をつかんで保持する」. Right heading「木製ハンマー」; a wooden mallet with smooth rectangular wood head and wooden handle securely fitted centrally, no steel striking face, realistic light wood grain. Below text「木製の頭部で打撃を加える」. Bottom slim note「対象に適合する工具と作業手順を確認する」. No brand names, no hands, no arrows or intricate unlabeled mechanical fragments. Large high-contrast type, lots of white space. Consistent product-illustration quality, no photoreal background.



## term_strain 再編集：寸法の整合

参照：初回生成PNG `exec-5eed9412-c57a-495b-81d5-9bbf3e7eba26.png`。

Correct ONE geometric alignment in this otherwise excellent Japanese strain diagram. Preserve ALL text, equations, material style and dimensions. The dashed vertical line from the upper bar's right end (original length L) MUST coincide exactly with the lower bar's silver-to-pink boundary AND the left extension tick of the ΔL dimension arrow. Currently the lower pink extension starts too far right of that dashed line. Move the pink boundary and left ΔL tick left until they align with the dashed line and original bar end; extend pink highlighted ΔL segment accordingly. Dashed line should visibly continue to the lower bar's top at this exact color boundary. Keep the lower bar's right end unchanged. This is critical: the entire length added past L is ΔL, and must be the pink section. Do not change wording or add any new text.

採用：`exec-57db3185-8416-43f6-92d1-4f52be8df149.png`。上段の元の長さ、破線、下段の色境界、ΔLの左端が一致することを目視確認。
