#!/usr/bin/env python3
"""
GlassTones Favicon Generator
錆びた金属テクスチャ背景からファビコンを作成
"""

from PIL import Image, ImageFilter, ImageEnhance
import os

def create_favicon():
    """背景画像からファビコンを作成"""
    
    # 入力画像パス
    input_path = "assets/rust_bg.jpg"
    
    if not os.path.exists(input_path):
        print(f"エラー: {input_path} が見つかりません")
        return
    
    try:
        # 背景画像を読み込み
        img = Image.open(input_path)
        print(f"元画像サイズ: {img.size}")
        
        # 正方形にクロップ（中央部分を使用）
        width, height = img.size
        size = min(width, height)
        left = (width - size) // 2
        top = (height - size) // 2
        right = left + size
        bottom = top + size
        
        img_square = img.crop((left, top, right, bottom))
        
        # コントラストとシャープネスを調整（ファビコン用に最適化）
        enhancer = ImageEnhance.Contrast(img_square)
        img_square = enhancer.enhance(1.3)  # コントラスト向上
        
        enhancer = ImageEnhance.Sharpness(img_square)
        img_square = enhancer.enhance(1.2)  # シャープネス向上
        
        # 複数サイズのファビコンを作成
        sizes = [16, 32, 48, 64, 128, 256]
        
        for size in sizes:
            # リサイズ（高品質）
            favicon = img_square.resize((size, size), Image.Resampling.LANCZOS)
            
            # ファイル名
            filename = f"favicon_{size}x{size}.png"
            
            # 保存
            favicon.save(filename, "PNG", optimize=True)
            print(f"作成完了: {filename}")
        
        # ICOファイルも作成（複数サイズ含む）
        ico_sizes = [(16, 16), (32, 32), (48, 48)]
        ico_images = []
        
        for size in ico_sizes:
            favicon = img_square.resize(size, Image.Resampling.LANCZOS)
            ico_images.append(favicon)
        
        # ICOファイル保存
        ico_images[0].save("favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
        print("作成完了: favicon.ico")
        
        print("\n✅ ファビコン作成完了！")
        print("作成されたファイル:")
        for size in sizes:
            print(f"  - favicon_{size}x{size}.png")
        print("  - favicon.ico")
        
    except Exception as e:
        print(f"エラー: {e}")

if __name__ == "__main__":
    create_favicon() 