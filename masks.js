let url = [
	// "https://coolors.co/264653-2a9d8f-e9c46a-f4a261-e76f51",
	// "https://coolors.co/001219-005f73-0a9396-94d2bd-e9d8a6-ee9b00-ca6702-bb3e03-ae2012-9b2226",
	"https://coolors.co/9b5de5-f15bb5-fee440-00bbf9-00f5d4",
];
let palette;
let noiseGra;
let sw;

function setup() {
	createCanvas(800, 800);
	colorMode(HSB, 360, 100, 100, 100);
	angleMode(DEGREES);

	//ノイズ画像を作る
	noiseGra = createGraphics(width, height);
	noiseGra.noStroke();
	noiseGra.fill(255, 15 / 100 * 255);
	for (let i = 0; i < width * height * 0.05; i++) {
		let x = random(width);
		let y = random(height);
		let dia = noise(x * 0.01, y * 0.01) * 1 + 1; //ノイズの値で円の大きさを
		noiseGra.ellipse(x, y, dia, dia);
	}
}

function draw() {
	clear();
	palette = createPalette(random(url), 100);
	// let n = int(random(palette.length));
	// let c = palette[n];
	// c.setAlpha(100);

	// palette.splice(n, 1);
	background(0, 0, 0);
	blendMode(ADD);

	let cells = int(random(1, 6));
	sw = map(cells, 1, 5, 5,1);
	let offset = width / 20;
	let margin = offset / 1.5;
	let d = (width - offset * 2 - margin * (cells - 1)) / cells;

	for (let j = 0; j < cells; j++) {
		for (let i = 0; i < cells; i++) {
			let xMin = offset + i * (d + margin);
			let yMin = offset + j * (d + margin);
			let xMax = xMin + d;
			let yMax = yMin + d;
			drawSepRect(xMin, yMin, xMax, yMax);
		}
	}

	image(noiseGra, 0, 0);

	frameRate(1 / 2);
}

function drawSepRect(xMin, yMin, xMax, yMax) {
	let w = (xMax - xMin);
	let h = (yMax - yMin);
	push();
	translate(xMin + w / 2, yMin + h / 2);
	scale(random() > 0.5 ? -1 : 1,
		random() > 0.5 ? -1 : 1
	);
	scale(0.85);
	// let rotate_num = int(random(4)) * 360 / 4;
	// if (rotate_num / 90 % 2 == 1) {
	//   let tmp = w;
	//   w = h;
	//   h = tmp;
	// }
	// rotate(rotate_num);
	translate(-w / 2, -h / 2);
	let x = 0;
	let y = 0;
	let yStep, xStep;

	while (y < h) {
		yStep = int(random(h / 3));
		if (y + yStep > h) yStep = h - y;
		x = 0;
		while (x < w / 2) {
			xStep = int(random(w / 2));
			if (x + xStep > w / 2) xStep = w / 2 - x;
			// stroke(0, 0, 50);
			noStroke();
			let shape_num = int(random(6));
			let sep = int(random(1, 5));
			drawingContext.shadowBlur = max(w, h) / 30;
			drawingContext.shadowColor = color(random(palette));
			ellipseMode(CENTER);
			rectMode(CENTER);
			let m = random(0.5, 10);
			if (min(xStep, yStep) > w / 40) {
				let angle = random(90, 270);
				let counter_angle = angle > 180 ? angle + abs(270 - angle) * 2 : angle - abs(angle - 90) * 2;
				let shear_x = random(15/2) * (random() > 0.5 ? -1:1);
				let shear_y = random(15/2) * (random() > 0.5 ? -1:1);
				let colors = shuffle(palette.concat());
				push();
				translate(x + xStep / 2, y + yStep / 2);
				let t = 0;
				let v = 0;
				for (let i = 1.3; i > 0; i -= 1 / sep) {
					push();
					scale(i);
					strokeWeight(1 / i * sw);
					shearX(shear_x);
					shearY(shear_y);
					rotate(angle);
					translate(-xStep / 2, -yStep / 2);
					stroke(colors[(t + v) % colors.length]);
					noFill();
					drawRandomShape(0, 0, xStep, yStep, shape_num, m);
					v++;
					pop();
				}
				pop();

				push();
				translate(w - x - xStep + xStep / 2, y + yStep / 2);
				scale(-1, 1);
				v = 0;
				for (let i = 1.3; i > 0; i -= 1 / sep) {
					push();
					scale(i);
					strokeWeight(1 / i * sw);
					shearX(shear_x);
					shearY(shear_y);
					rotate(angle);
					translate(-xStep / 2, -yStep / 2);
					stroke(colors[[t + v] % colors.length]);
					noFill();
					drawRandomShape(0, 0, xStep, yStep, shape_num, m);
					v++;
					pop();
				}
				pop();
			}
			x += xStep;
		}
		y += yStep;
	}
	pop();
}

function drawRandomShape(x, y, w, h, shape_num = int(random(6)), m) {
	switch (shape_num) {
		case 0:
			ellipse(x + w / 2, y + h / 2, w, h);
			break;
		case 1:
			arc(x, y, w * 2, h * 2, 0, 90, PIE);
			break;
		case 2:
			quad(x, y, x + w / 2, y, x + w, y + h, x + w / 2, y + h);
			break;
		case 3:
			circle(x + w / 2, y + h / 2, min(w, h));
			break;
		case 4:
			rect(x, y, w, h, max(w, h));
			break;
		case 5:
			triangle(x, y, x + w, y + h, x + w, y);
			break;
		case 6:
			drawSuperEllipes(x + w / 2, y + h / 2, w, h, m);
			break;
	}
}

function createPalette(_url, percent = 100) {
	let slash_index = _url.lastIndexOf('/');
	let pallate_str = _url.slice(slash_index + 1);
	let arr = pallate_str.split('-');
	for (let i = 0; i < arr.length; i++) {
		arr[i] = color('#' + arr[i] + hex(int(percent / 100 * 255), 2));
	}
	return arr;
}

function drawSuperEllipes(x, y, w, h, n) {
	push();
	translate(x, y);
	let na = 2 / n;
	beginShape();
	for (let angle = 0; angle < 360; angle += 2) {
		let x = pow(abs(cos(angle)), na) * w / 2 * sgn(cos(angle));
		let y = pow(abs(sin(angle)), na) * h / 2 * sgn(sin(angle));
		vertex(x, y);
	}
	endShape(CLOSE);
	pop();
}

function sgn(val) {
	if (val == 0) {
		return 0;
	}
	return val / abs(val);
}