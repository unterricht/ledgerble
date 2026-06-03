const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

const translations = {
  "table.account": { en: "Account", de: "Konto", es: "Cuenta", fr: "Compte", it: "Conto" },
  "table.asset": { en: "Asset", de: "Anlage", es: "Activo", fr: "Actif", it: "Asset" },
  "table.quantity": { en: "Quantity", de: "Menge", es: "Cantidad", fr: "Quantité", it: "Quantità" },
  "table.cost_basis": { en: "Cost Basis", de: "Kostenbasis", es: "Base de coste", fr: "Prix de revient", it: "Base di costo" },
  "table.market_value": { en: "Market Value", de: "Marktwert", es: "Valor de mercado", fr: "Valeur de mercato", it: "Valore di mercato" },
  "table.unrealized": { en: "Unrealized Gain", de: "Nicht realisierter Gewinn", es: "Ganancia no realizada", fr: "Plus-value latente", it: "Plusvalenza non realizzata" }
};

for (const file of files) {
  const lang = path.basename(file, '.json').split('-')[0];
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  for (const [key, tmap] of Object.entries(translations)) {
    if (!data[key]) {
      data[key] = tmap[lang] || tmap.en;
    }
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

console.log('Translations updated.');
