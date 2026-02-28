import React from 'react'
import { trpc } from '../lib/trpc'
import { useProducts } from '../contexts/ProductContext'

interface ReportData {
  totalProducts: number
  totalStock: number
  totalValue: number
  averagePrice: number
  lowStockProducts: number
  totalSales: number
  totalPurchases: number
  totalSalesCount: number
  totalPurchasesCount: number
  averageRevenue: number
  profitMargin: number

  // NOVO: Devoluções
  totalReturns: number
  totalDefectiveQuantity: number
  returnRate: number
  mostReturnedProducts: Array<{ name: string; count: number }>
  defectiveProducts: Array<{ name: string; code: string; defectiveQuantity: number }>
}

export function ReportGenerator() {
  const { products } = useProducts()
  const { data: transactions = [] } = trpc.transactions.list.useQuery()
  const { data: returns = [] } = trpc.returns.list.useQuery()

  const calculateReportData = (): ReportData => {
    const totalProducts = products.length
    const totalStock = products.reduce((sum, p) => sum + p.quantity, 0)
    const totalValue = products.reduce((sum, p) => sum + p.price * p.quantity, 0)
    const averagePrice = totalStock > 0 ? totalValue / totalStock : 0
    const lowStockProducts = products.filter(p => p.quantity <= p.minQuantity).length

    const sales = transactions.filter(tx => tx.type === 'sale')
    const purchases = transactions.filter(tx => tx.type === 'purchase')
    const totalSales = sales
      .reduce((sum, tx) => sum + parseFloat(tx.amount || '0'), 0)

    const totalPurchases = purchases
      .reduce((sum, tx) => sum + parseFloat(tx.amount || '0'), 0)
    const totalSalesCount = sales.length
    const totalPurchasesCount = purchases.length
    const averageRevenue = totalSalesCount > 0 ? totalSales / totalSalesCount : 0
    const profitMargin = totalSales > 0 ? ((totalSales - totalPurchases) / totalSales) * 100 : 0

    // Calcular devoluções
    const totalReturns = returns.length
    const totalDefectiveQuantity = products.reduce((sum, p) => sum + (p.defectiveQuantity || 0), 0)
    const defectiveProducts = products
      .filter(p => (p.defectiveQuantity || 0) > 0)
      .map(p => ({
        name: p.name,
        code: p.code,
        defectiveQuantity: p.defectiveQuantity || 0,
      }))
      .sort((a, b) => b.defectiveQuantity - a.defectiveQuantity)
    const returnRate = totalSalesCount > 0 ? (totalReturns / totalSalesCount) * 100 : 0

    // Produtos mais devolvidos
    const returnsByProduct = returns.reduce((acc, ret) => {
      const key = ret.productName || 'Desconhecido'
      acc[key] = (acc[key] || 0) + ret.quantity
      return acc
    }, {} as Record<string, number>)

    const mostReturnedProducts = Object.entries(returnsByProduct)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalProducts,
      totalStock,
      totalValue,
      averagePrice,
      lowStockProducts,
      totalSales,
      totalPurchases,
      totalSalesCount,
      totalPurchasesCount,
      averageRevenue,
      profitMargin,

      // NOVO: Devoluções
      totalReturns,
      totalDefectiveQuantity,
      returnRate,
      mostReturnedProducts,
      defectiveProducts,
    }
  }

  const buildReportHtml = (data: ReportData) => {
    const today = new Date().toLocaleDateString('pt-BR')
    const filename = `relatorio-estoque-${new Date().toISOString().split('T')[0]}.pdf`

    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Vendas - StockTech</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
          }
          .actions {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            justify-content: flex-end;
          }
          .actions button {
            border: none;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
          }
          .actions .download {
            background: #16a34a;
            color: white;
          }
          .actions .print {
            background: #2563eb;
            color: white;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #0066cc;
            font-size: 28px;
          }
          .header p {
            margin: 5px 0;
            color: #666;
            font-size: 12px;
          }
          .section {
            margin-bottom: 30px;
          }
          .section h2 {
            background-color: #0066cc;
            color: white;
            padding: 10px;
            margin: 0 0 15px 0;
            font-size: 16px;
          }
          .metrics {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
          }
          .metric {
            border: 1px solid #ddd;
            padding: 15px;
            border-radius: 5px;
            background-color: #f9f9f9;
          }
          .metric-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
          }
          .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #0066cc;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background-color: #e6f0ff;
            padding: 10px;
            text-align: left;
            border: 1px solid #ddd;
            font-weight: bold;
            color: #0066cc;
          }
          td {
            padding: 10px;
            border: 1px solid #ddd;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 11px;
            color: #999;
          }
          .highlight {
            background-color: #fff3cd;
            padding: 10px;
            border-left: 4px solid #ffc107;
            margin-bottom: 15px;
          }
          @media print {
            .actions {
              display: none;
            }
          }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      </head>
      <body>
        <div class="actions">
          <button class="download" onclick="downloadPDF()">Baixar PDF</button>
          <button class="print" onclick="window.print()">Imprimir</button>
        </div>
        <div id="report">
        <div class="header">
          <h1>📊 Relatório de Vendas e Estoque</h1>
          <p>StockTech Dev - Gestão de Inventário</p>
          <p>Gerado em: ${today}</p>
        </div>

        <div class="section">
          <h2>📈 Resumo Executivo</h2>
          <div class="metrics">
            <div class="metric">
              <div class="metric-label">Produtos Cadastrados</div>
              <div class="metric-value">${data.totalProducts}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Estoque Total</div>
              <div class="metric-value">${data.totalStock}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Valor em Inventário</div>
              <div class="metric-value">R$ ${(data.totalValue / 1000).toFixed(1)}k</div>
            </div>
            <div class="metric">
              <div class="metric-label">Preço Médio</div>
              <div class="metric-value">R$ ${data.averagePrice.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</div>
            </div>
          </div>
          
          ${data.lowStockProducts > 0 ? `
            <div class="highlight">
              <strong>⚠️ Atenção:</strong> ${data.lowStockProducts} produto(s) com estoque baixo. Recomenda-se reabastecimento.
            </div>
          ` : ''}
        </div>

        <div class="section">
          <h2>💰 Análise Financeira</h2>
          <div class="metrics">
            <div class="metric">
              <div class="metric-label">Total de Vendas</div>
              <div class="metric-value">R$ ${(data.totalSales / 1000).toFixed(1)}k</div>
            </div>
            <div class="metric">
              <div class="metric-label">Total de Compras</div>
              <div class="metric-value">R$ ${(data.totalPurchases / 1000).toFixed(1)}k</div>
            </div>
            <div class="metric">
              <div class="metric-label">Margem de Lucro</div>
              <div class="metric-value">${data.profitMargin.toFixed(1)}%</div>
            </div>
            <div class="metric">
              <div class="metric-label">Lucro Líquido</div>
              <div class="metric-value">R$ ${((data.totalSales - data.totalPurchases) / 1000).toFixed(1)}k</div>
            </div>
            <div class="metric">
              <div class="metric-label">Quantidade de Vendas</div>
              <div class="metric-value">${data.totalSalesCount}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Quantidade de Compras</div>
              <div class="metric-value">${data.totalPurchasesCount}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Média de Faturamento</div>
              <div class="metric-value">R$ ${data.averageRevenue.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>📦 Produtos em Estoque</h2>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Quantidade</th>
                <th>Defeituosas</th>
                <th>Preço Unit.</th>
                <th>Valor Total</th>
              </tr>
            </thead>
            <tbody>
              ${products.map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td>${p.quantity}</td>
                  <td>${p.defectiveQuantity || 0}</td>
                  <td>R$ ${p.price.toLocaleString('pt-BR')}</td>
                  <td>R$ ${(p.price * p.quantity).toLocaleString('pt-BR')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>🔄 Devoluções e Trocas</h2>
          <div class="metrics">
            <div class="metric">
              <div class="metric-label">Total de Devoluções</div>
              <div class="metric-value">${data.totalReturns}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Peças Defeituosas</div>
              <div class="metric-value">${data.totalDefectiveQuantity}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Taxa de Devolução</div>
              <div class="metric-value">${data.returnRate.toFixed(1)}%</div>
            </div>
          </div>

          ${data.mostReturnedProducts.length > 0 ? `
            <h3 style="margin-top: 20px; font-size: 14px; color: #666;">Produtos Mais Devolvidos</h3>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Quantidade Devolvida</th>
                </tr>
              </thead>
              <tbody>
                ${data.mostReturnedProducts.map(p => `
                  <tr>
                    <td>${p.name}</td>
                    <td>${p.count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          ${data.defectiveProducts.length > 0 ? `
            <h3 style="margin-top: 20px; font-size: 14px; color: #666;">Lista de Peças Defeituosas (Estoque)</h3>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Código</th>
                  <th>Quantidade Defeituosa</th>
                </tr>
              </thead>
              <tbody>
                ${data.defectiveProducts.map(p => `
                  <tr>
                    <td>${p.name}</td>
                    <td>${p.code}</td>
                    <td>${p.defectiveQuantity}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </div>

        <div class="footer">
          <p>Este relatório foi gerado automaticamente pelo sistema StockTech Dev.</p>
          <p>Para mais informações, acesse o dashboard de vendedor.</p>
        </div>
        </div>
        <script>
          function downloadPDF() {
            const element = document.getElementById('report');
            const opt = {
              margin: 8,
              filename: '${filename}',
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(element).save();
          }
        </script>
      </body>
      </html>
    `
    return htmlContent
  }

  const openReportWindow = (autoDownload: boolean) => {
    const data = calculateReportData()
    const htmlContent = buildReportHtml(data)
    const reportWindow = window.open('', '_blank', 'width=1024,height=768')
    if (!reportWindow) return
    reportWindow.document.open()
    reportWindow.document.write(htmlContent)
    reportWindow.document.close()
    if (autoDownload) {
      reportWindow.addEventListener('load', () => {
        reportWindow.document.querySelector<HTMLButtonElement>('.download')?.click()
      })
    }
  }

  const generatePDF = () => {
    openReportWindow(true)
  }

  const generatePrint = () => {
    openReportWindow(false)
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={generatePDF}
        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        📄 PDF
      </button>
      <button
        onClick={generatePrint}
        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        🖨️ Imprimir
      </button>
    </div>
  )
}
