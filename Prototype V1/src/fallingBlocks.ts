const canvas = document.getElementById('matrix-canvas') as HTMLCanvasElement;
const ctx = canvas?.getContext('2d');

if (canvas && ctx) {
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    const SHAPE_NAMES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    const BLOCK_SPRITES: Record<string, HTMLImageElement> = {};
    
    SHAPE_NAMES.forEach(shape => {
        const img = new Image();
        img.src = `/blocks/${shape}-block.png`;
        BLOCK_SPRITES[shape] = img;
    });

    const TETROMINOES: Record<string, number[][]> = {
        'I': [[1, 1, 1, 1]],
        'J': [[1, 0, 0], [1, 1, 1]],
        'L': [[0, 0, 1], [1, 1, 1]],
        'O': [[1, 1], [1, 1]],
        'S': [[0, 1, 1], [1, 1, 0]],
        'T': [[0, 1, 0], [1, 1, 1]],
        'Z': [[1, 1, 0], [0, 1, 1]]
    };

    class Drop {
        shapeType: string;
        shape: number[][];
        blockSize: number;
        x: number;
        y: number;
        speed: number;

        constructor() {
            this.shapeType = 'I';
            this.shape = TETROMINOES['I'];
            this.blockSize = 20;
            this.x = 0;
            this.y = 0;
            this.speed = 2;
            this.reset(true);
        }

        reset(initial = false) {
            this.shapeType = SHAPE_NAMES[Math.floor(Math.random() * SHAPE_NAMES.length)];
            this.shape = TETROMINOES[this.shapeType];
            
            this.blockSize = 15 + Math.floor(Math.random() * 20); // 15 to 35px
            this.speed = 2 + Math.random() * 3; // Pixels per frame

            const isDesktop = width >= 768;
            const bannerWidth = isDesktop ? width * 0.18 : width * 0.15;
            const shapePixelWidth = this.shape[0].length * this.blockSize;

            const isLeft = Math.random() > 0.5;

            if (isDesktop) {
                if (isLeft) {
                    this.x = Math.random() * Math.max(0, bannerWidth - shapePixelWidth);
                } else {
                    this.x = width - bannerWidth + Math.random() * Math.max(0, bannerWidth - shapePixelWidth);
                }
            } else {
                this.x = Math.random() * (width - shapePixelWidth);
            }

            this.y = initial ? Math.random() * height : - (this.shape.length * this.blockSize) - Math.random() * 200;
        }

        update() {
            this.y += this.speed;

            if (this.y > height + 100) {
                this.reset();
            }
        }

        draw(ctx: CanvasRenderingContext2D) {
            const img = BLOCK_SPRITES[this.shapeType];
            const isLoaded = img && img.complete && img.naturalWidth > 0;

            for (let r = 0; r < this.shape.length; r++) {
                for (let c = 0; c < this.shape[r].length; c++) {
                    if (this.shape[r][c]) {
                        const px = this.x + c * this.blockSize;
                        const py = this.y + r * this.blockSize;

                        if (isLoaded) {
                            ctx.drawImage(img, px, py, this.blockSize, this.blockSize);
                        } else {
                            ctx.fillStyle = '#00FFFF';
                            ctx.fillRect(px, py, this.blockSize, this.blockSize);
                        }
                    }
                }
            }
        }
    }

    const drops: Drop[] = [];
    const numDrops = 4; 
    for (let i = 0; i < numDrops; i++) {
        drops.push(new Drop());
    }

    function animate() {
        if (!ctx) return;
        
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';

        drops.forEach(drop => {
            drop.update();
            drop.draw(ctx);
        });
        requestAnimationFrame(animate);
    }
    animate();
}