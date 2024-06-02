import { NS } from '@ns';

const MIN_MONEY = 10_000_000;

export async function main(ns: NS) {
  ns.tail();

  const symbols = ns.stock.getSymbols();

  const lastForecast: Record<string, number> = {};
  let tick = 0;

  while (true) {
    tick++;
    await ns.stock.nextUpdate();
    ns.printf('\n');

    const newForecast: [string, number][] = [];
    for (const sym of symbols) {
      newForecast.push([sym, ns.stock.getForecast(sym)]);
    }

    newForecast.sort((a, b) => b[1] - a[1]);

    let totalChange = 0;

    for (const entry of newForecast) {
      if (lastForecast[entry[0]] !== entry[1]) {
        const price = ns.stock.getPrice(entry[0]);
        const position = ns.stock.getPosition(entry[0]);
        const current = price * position[0];
        const holding = position[1] * position[0];
        if (holding > 0) {
          ns.printf(
            'INFO Changed %5s: %s -> %s -> %8s - %8s = %9s (%6s)',
            entry[0],
            ns.formatPercent(lastForecast[entry[0]] || 0),
            ns.formatPercent(entry[1]),
            ns.formatNumber(current),
            ns.formatNumber(holding),
            ns.formatNumber(current - holding),
            ns.formatPercent(current / holding - 1),
          );
        } else {
          ns.printf(
            'INFO Changed %5s: %s -> %s',
            entry[0],
            ns.formatPercent(lastForecast[entry[0]] || 0),
            ns.formatPercent(entry[1]),
          );
        }
      }
      totalChange += Math.abs((lastForecast[entry[0]] || 0) - entry[1]);
      lastForecast[entry[0]] = entry[1];
    }

    if (totalChange > 0.2) {
      tick = 1;
    }

    ns.printf(
      'SUCCESS [%d/%d] Total Change: %s',
      tick,
      ns.stock.getConstants().TicksPerCycle,
      ns.formatPercent(totalChange),
    );

    // First try to sell
    for (const n of newForecast) {
      const sym = n[0];
      const forecast = lastForecast[sym];
      const price = ns.stock.getPrice(sym);
      const position = ns.stock.getPosition(sym);

      if (forecast <= 0.55) {
        // If symbol is below 55%, sell long
        if (position[0] !== 0) {
          ns.printf(
            'INFO [%s][%s][%s] Selling for %s',
            sym,
            ns.formatNumber(price),
            ns.formatPercent(forecast),
            ns.formatNumber(price * position[0]),
          );

          ns.stock.sellStock(sym, position[0]);
        }
      } else if (forecast >= 0.45) {
        // If symbol is above 45% sell short
      }
    }

    // Then try buying them
    for (const n of newForecast) {
      const sym = n[0];
      const forecast = lastForecast[sym];
      const maxShares = ns.stock.getMaxShares(sym);
      const price = ns.stock.getPrice(sym);
      const position = ns.stock.getPosition(sym);
      let buyShares = Math.min(maxShares, Math.floor((ns.getPlayer().money - MIN_MONEY) / price));

      if (forecast >= 0.6) {
        // If symbol is >= 60%, buy long
        if (position[0] === 0) {
          for (let i = buyShares; i > 100; i -= 10) {
            const cost = ns.stock.getPurchaseCost(sym, i, 'Long');
            if (cost < 300_000) {
              buyShares = 0;
              break;
            }

            if (cost < ns.getPlayer().money - MIN_MONEY) {
              buyShares = i;
              break;
            }
          }

          if (buyShares >= 1) {
            ns.printf(
              'INFO [%s][%s][%s] Long for %s',
              sym,
              ns.formatNumber(price),
              ns.formatPercent(forecast),
              ns.formatNumber(price * buyShares),
            );

            ns.stock.buyStock(sym, buyShares);
          }
        }
      } else if (forecast <= 0.4) {
        // If symbol is <= 40%, buy short
      }
    }
  }
}
