#!/usr/bin/env python3
# ========================================
# STOCKTECH - Seeds (Categories, Brands, Demo Products)
# ========================================

import asyncio
import sys
from pathlib import Path
from decimal import Decimal
from datetime import datetime
from slugify import slugify

# Add app to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from sqlalchemy import select
from app.core.database import AsyncSessionFactory
from app.models import (
    Category, Brand, Product,
    ProductStatus, ProductCondition
)

async def create_categories():
    """Create initial product categories"""
    
    categories_data = [
        {
            "name": "Smartphones",
            "slug": "smartphones",
            "description": "Smartphones de todas as marcas e modelos",
            "icon": "smartphone",
            "color": "#3B82F6",
            "display_order": 1,
            "is_featured": True
        },
        {
            "name": "Acessórios",
            "slug": "acessorios", 
            "description": "Capas, películas, carregadores e acessórios",
            "icon": "cable",
            "color": "#10B981",
            "display_order": 2,
            "is_featured": True
        },
        {
            "name": "Tablets",
            "slug": "tablets",
            "description": "Tablets e iPads de várias marcas",
            "icon": "tablet",
            "color": "#8B5CF6",
            "display_order": 3,
            "is_featured": False
        },
        {
            "name": "Smartwatches",
            "slug": "smartwatches",
            "description": "Relógios inteligentes e wearables",
            "icon": "watch",
            "color": "#F59E0B",
            "display_order": 4,
            "is_featured": False
        },
        {
            "name": "Áudio",
            "slug": "audio",
            "description": "Fones, caixas de som e equipamentos de áudio",
            "icon": "headphones",
            "color": "#EF4444",
            "display_order": 5,
            "is_featured": False
        },
        {
            "name": "Gaming",
            "slug": "gaming",
            "description": "Consoles, jogos e acessórios gamer",
            "icon": "gamepad",
            "color": "#6366F1",
            "display_order": 6,
            "is_featured": False
        }
    ]
    
    async with AsyncSessionFactory() as db:
        try:
            created_categories = []
            
            for cat_data in categories_data:
                # Check if category exists
                result = await db.execute(
                    select(Category.id).where(Category.slug == cat_data["slug"])
                )
                if result.scalar():
                    print(f"⚠️  Categoria {cat_data['name']} já existe, pulando...")
                    continue
                
                category = Category(**cat_data)
                db.add(category)
                created_categories.append(category)
                print(f"✅ Categoria criada: {category.name}")
            
            await db.commit()
            print(f"📋 Total: {len(created_categories)} categorias criadas")
            
            # Return categories for use in products  
            return created_categories
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Erro ao criar categorias: {e}")
            raise

async def create_brands():
    """Create initial product brands"""
    
    brands_data = [
        {
            "name": "Apple",
            "slug": "apple",
            "description": "iPhone, iPad, MacBook e acessórios Apple",
            "website_url": "https://apple.com",
            "country_origin": "US",
            "founded_year": 1976,
            "is_premium": True,
            "display_order": 1
        },
        {
            "name": "Samsung",
            "slug": "samsung",
            "description": "Galaxy smartphones, tablets e eletrônicos Samsung",
            "website_url": "https://samsung.com.br",
            "country_origin": "KR",
            "founded_year": 1938,
            "is_premium": True,
            "display_order": 2
        },
        {
            "name": "Xiaomi",
            "slug": "xiaomi",
            "description": "Smartphones Xiaomi, Redmi e Poco",
            "website_url": "https://mi.com",
            "country_origin": "CN",
            "founded_year": 2010,
            "is_premium": False,
            "display_order": 3
        },
        {
            "name": "Motorola",
            "slug": "motorola",
            "description": "Smartphones Motorola Edge e Moto G",
            "website_url": "https://motorola.com.br",
            "country_origin": "US",
            "founded_year": 1928,
            "is_premium": False,
            "display_order": 4
        },
        {
            "name": "Huawei",
            "slug": "huawei",
            "description": "Smartphones e tablets Huawei",
            "website_url": "https://huawei.com",
            "country_origin": "CN",
            "founded_year": 1987,
            "is_premium": True,
            "display_order": 5
        },
        {
            "name": "Sony",
            "slug": "sony",
            "description": "PlayStation, fones e eletrônicos Sony",
            "website_url": "https://sony.com.br",
            "country_origin": "JP",
            "founded_year": 1946,
            "is_premium": True,
            "display_order": 6
        }
    ]
    
    async with AsyncSessionFactory() as db:
        try:
            created_brands = []
            
            for brand_data in brands_data:
                # Check if brand exists
                result = await db.execute(
                    select(Brand.id).where(Brand.slug == brand_data["slug"])
                )
                if result.scalar():
                    print(f"⚠️  Marca {brand_data['name']} já existe, pulando...")
                    continue
                
                brand = Brand(**brand_data)
                db.add(brand)
                created_brands.append(brand)
                print(f"✅ Marca criada: {brand.name}")
            
            await db.commit()
            print(f"🏷️  Total: {len(created_brands)} marcas criadas")
            
            return created_brands
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Erro ao criar marcas: {e}")
            raise

async def create_demo_products(categories, brands):
    """Create demo products for marketplace"""
    
    if not categories or not brands:
        print("⚠️  Sem categorias/marcas, pulando produtos demo")
        return
    
    # Find specific categories and brands
    smartphone_category = next((c for c in categories if c.slug == "smartphones"), categories[0])
    acessorios_category = next((c for c in categories if c.slug == "acessorios"), categories[1])
    
    apple_brand = next((b for b in brands if b.slug == "apple"), brands[0])
    samsung_brand = next((b for b in brands if b.slug == "samsung"), brands[1])
    xiaomi_brand = next((b for b in brands if b.slug == "xiaomi"), brands[2])
    
    products_data = [
        {
            "account_id": "010d079d-097c-4462-8d83-98b2366d934a",  # Demo account from AvAdmin
            "user_id": "163368e0-efc5-4644-bee1-b6a19c631280",     # Demo user from AvAdmin
            "code": "ST000001A",
            "name": "iPhone 15 Pro Max 256GB Space Black",
            "description": """
iPhone 15 Pro Max com 256GB de armazenamento em Space Black.
- Tela Super Retina XDR de 6,7 polegadas
- Chip A17 Pro com GPU de 6 núcleos
- Sistema de câmera Pro avançado
- Action Button
- Conector USB-C
- Produto lacrado com nota fiscal
            """.strip(),
            "category_id": smartphone_category.id,
            "brand_id": apple_brand.id,
            "price": Decimal("8500.00"),
            "original_price": Decimal("9000.00"),
            "stock_quantity": 5,
            "condition": ProductCondition.NEW,
            "status": ProductStatus.ACTIVE,
            "is_featured": True,
            "specifications": {
                "display": "6.7-inch Super Retina XDR",
                "storage": "256GB",
                "color": "Space Black",
                "processor": "A17 Pro",
                "camera": "48MP + 12MP + 12MP",
                "battery": "4441mAh",
                "os": "iOS 17"
            },
            "images": [
                {
                    "url": "/uploads/products/iphone15pro_front.jpg",
                    "thumbnail": "/uploads/products/thumb_iphone15pro_front.jpg",
                    "alt": "iPhone 15 Pro Max frontal",
                    "is_primary": True,
                    "order": 1
                }
            ],
            "weight_kg": Decimal("0.221"),
            "dimensions": "159.9×76.7×8.25mm"
        },
        {
            "account_id": "010d079d-097c-4462-8d83-98b2366d934a",
            "user_id": "163368e0-efc5-4644-bee1-b6a19c631280",
            "code": "ST000002B", 
            "name": "Samsung Galaxy S24 Ultra 512GB Titanium Gray",
            "description": """
Samsung Galaxy S24 Ultra com 512GB em Titanium Gray.
- Tela Dynamic AMOLED 2X de 6,8 polegadas
- Processador Snapdragon 8 Gen 3
- S Pen inclusa
- Câmera de 200MP
- Resistente à água IP68
            """.strip(),
            "category_id": smartphone_category.id,
            "brand_id": samsung_brand.id,
            "price": Decimal("7200.00"),
            "stock_quantity": 3,
            "condition": ProductCondition.NEW,
            "status": ProductStatus.ACTIVE,
            "specifications": {
                "display": "6.8-inch Dynamic AMOLED 2X",
                "storage": "512GB",
                "color": "Titanium Gray",
                "processor": "Snapdragon 8 Gen 3", 
                "camera": "200MP + 50MP + 12MP + 10MP",
                "battery": "5000mAh",
                "os": "Android 14"
            },
            "weight_kg": Decimal("0.232"),
            "dimensions": "162.3×79.0×8.6mm"
        },
        {
            "account_id": "010d079d-097c-4462-8d83-98b2366d934a",
            "user_id": "163368e0-efc5-4644-bee1-b6a19c631280",
            "code": "ST000003C",
            "name": "Xiaomi 14 Ultra 512GB Black",
            "description": """
Xiaomi 14 Ultra com 512GB em Black.
- Tela LTPO OLED de 6,73 polegadas
- Snapdragon 8 Gen 3
- Câmera Leica de 50MP
- Carregamento rápido de 90W
- Excelente custo-benefício
            """.strip(),
            "category_id": smartphone_category.id,
            "brand_id": xiaomi_brand.id,
            "price": Decimal("4500.00"),
            "stock_quantity": 8,
            "condition": ProductCondition.NEW,
            "status": ProductStatus.ACTIVE,
            "specifications": {
                "display": "6.73-inch LTPO OLED",
                "storage": "512GB",
                "color": "Black",
                "processor": "Snapdragon 8 Gen 3",
                "camera": "50MP Leica + 50MP + 50MP + 50MP",
                "battery": "5300mAh",
                "os": "MIUI 15 (Android 14)"
            },
            "weight_kg": Decimal("0.224"),
            "dimensions": "161.4×75.3×9.2mm"
        },
        {
            "account_id": "010d079d-097c-4462-8d83-98b2366d934a",
            "user_id": "163368e0-efc5-4644-bee1-b6a19c631280",
            "code": "ST000004D",
            "name": "Capa iPhone 15 Pro Max Silicone Apple Original",
            "description": """
Capa de silicone original Apple para iPhone 15 Pro Max.
- Material silicone premium
- Proteção total do aparelho
- Acesso a todos os botões
- Cores disponíveis
- Produto original Apple
            """.strip(),
            "category_id": acessorios_category.id,
            "brand_id": apple_brand.id,
            "price": Decimal("450.00"),
            "stock_quantity": 20,
            "condition": ProductCondition.NEW,
            "status": ProductStatus.ACTIVE,
            "specifications": {
                "material": "Silicone",
                "compatibility": "iPhone 15 Pro Max",
                "protection": "Drop protection",
                "colors": "Multiple colors available"
            },
            "weight_kg": Decimal("0.045"),
            "allows_negotiation": False  # Fixed price accessory
        }
    ]
    
    async with AsyncSessionFactory() as db:
        try:
            created_products = []
            
            for product_data in products_data:
                # Check if product exists
                result = await db.execute(
                    select(Product.id).where(Product.code == product_data["code"])
                )
                if result.scalar():
                    print(f"⚠️  Produto {product_data['code']} já existe, pulando...")
                    continue
                
                # Generate slug from name
                product_data["slug"] = slugify(product_data["name"])
                
                product = Product(**product_data)
                db.add(product)
                created_products.append(product)
                print(f"✅ Produto criado: {product.name} - {product.price}")
            
            await db.commit()
            print(f"📱 Total: {len(created_products)} produtos criados")
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Erro ao criar produtos: {e}")
            raise

async def update_counters():
    """Update category and brand product counters"""
    
    async with AsyncSessionFactory() as db:
        try:
            # Update category counters
            categories = await db.execute(select(Category))
            for category in categories.scalars().all():
                count_result = await db.execute(
                    select(Product).where(
                        Product.category_id == category.id,
                        Product.status == ProductStatus.ACTIVE
                    )
                )
                category.product_count = len(count_result.scalars().all())
                print(f"📊 Categoria {category.name}: {category.product_count} produtos")
            
            # Update brand counters  
            brands = await db.execute(select(Brand))
            for brand in brands.scalars().all():
                count_result = await db.execute(
                    select(Product).where(
                        Product.brand_id == brand.id,
                        Product.status == ProductStatus.ACTIVE
                    )
                )
                brand.product_count = len(count_result.scalars().all())
                print(f"🏷️  Marca {brand.name}: {brand.product_count} produtos")
            
            await db.commit()
            print("✅ Contadores atualizados")
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Erro ao atualizar contadores: {e}")

async def main():
    """Main seed function"""
    print("🌱 Criando dados iniciais do StockTech...")
    print("========================================")
    
    try:
        # 1. Create categories
        print("\n📋 1. Criando categorias...")
        categories = await create_categories()
        
        # 2. Create brands
        print("\n🏷️  2. Criando marcas...")
        brands = await create_brands()
        
        # 3. Create demo products
        print("\n📱 3. Criando produtos demo...")
        await create_demo_products(categories, brands)
        
        # 4. Update counters
        print("\n📊 4. Atualizando contadores...")
        await update_counters()
        
        print("\n🎉 Seeds do StockTech concluídos!")
        print("=================================")
        print()
        print("📊 Dados criados:")
        print("   📋 6 categorias de produtos")
        print("   🏷️  6 marcas principais")
        print("   📱 4 produtos demo")
        print()
        print("💡 Produtos de exemplo:")
        print("   • iPhone 15 Pro Max (ST000001A) - R$ 8.500,00")
        print("   • Galaxy S24 Ultra (ST000002B) - R$ 7.200,00")
        print("   • Xiaomi 14 Ultra (ST000003C) - R$ 4.500,00")
        print("   • Capa iPhone (ST000004D) - R$ 450,00")
        print()
        print("🔗 Os produtos estão vinculados à empresa demo do AvAdmin")
        print("   CNPJ: 12.345.678/0001-00")
        print("   Usuário: João Silva Santos (CPF: 123.456.789-00)")
        print()
        print("💡 Próximo passo: Implementar APIs de catálogo")
        
    except Exception as e:
        print(f"\n❌ Erro durante seeds: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)