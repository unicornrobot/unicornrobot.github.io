//AnniAlbers - Senbaku - https://openprocessing.org/sketch/2141478
let t = 0.0;
let vel = 0.02;
let num;
let palette_selected;

function setup() {
	createCanvas(800, 800);
	pixelDensity(2)
	angleMode(DEGREES);
	num = random(100000);
	palette_selected = random(palettes);
	pg = createGraphics(width, height);
	pg.noStroke();
	for (let i = 0; i < 300000; i++) {
		let x = random(width);
		let y = random(height);
		let n = noise(x * 0.01, y * 0.01) * width * 0.002;
		pg.fill(255, 30);
		pg.rect(x, y, n, n);
	}
}

function draw() {
	randomSeed(num);
	background("#f4f1de");
	stroke("#355070");
	tile();
	image(pg, 0, 0)
}

function tile() {
	let countW = int(random(4, 10)); // 行あたりのタイルスペースの数
	let countH = int(random(4, 7));
	let marginW = width * 0.3;
	let marginH = height * 0.1;

	let w = (width - marginW * 2) / countW; // 1倍幅のタイルの幅
	let h = (height - marginH * 2) / countH;

	for (let j = 0; j < countH; j++) {
		let y = marginH + j * h;
		let x = marginW;
		let spaceUsed = 0; // 既に使用されたスペース

		while (spaceUsed < countW) {
			// 現在のスペースで1倍または2倍のタイルを置けるか確認
			let spaceLeft = countW - spaceUsed;
			let tileMultiplier = spaceLeft >= 2 && random() < 0.5 ? 2 : 1;

			// タイルを描画
			push();
			// rect(x, y, w * tileMultiplier, h);
			shape(x, y, w * tileMultiplier, h);
			pop();

			// スペースとx座標を更新
			spaceUsed += tileMultiplier;
			x += w * tileMultiplier;
		}
	}
}

function shape(x, y, w, h) {

	push();
	translate(x, y)
	fill(random(palette_selected))
	// stroke(random(palette_selected))
	noStroke();
	rect(0, 0, w, h)
	let rannum = random([3, 6, 10])
	fill(random(palette_selected))
	noStroke();
	for (let i = 0; i < rannum; i++) {
		rect(0, h / rannum * i + 1, w, map(rannum, 3, 10, 10, 3))
	}
	pop();
}