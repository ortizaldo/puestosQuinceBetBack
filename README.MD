# Puestos 15 BET

### Pre-requisitos 📋

_NodeJS_

_MongoDB_

_migrate-mongo(https://www.npmjs.com/package/migrate-mongo)_

### Instalación 🔧

_Estos son los comandos para instalar el proyecto:_

_Primero descargamos el proyecto en nuestro sistema_

_Despues instalamos todas sus dependencias con npm i_

_Para ejecutar los migrates primero tenemos que instalar la libreria migrate-mongo_

_npm i migrate-mongo_

El comando para insertar la información en mongodb utilizando migrate-mongo es el siguiente:

_migrate-mongo up_

El comando para eliminar la información en mongodb utilizando migrate-mongo es el siguiente:

_migrate-mongo down_

### Depósitos y Wallet

Las solicitudes de depósito usan el almacenamiento Cloudinary que ya emplean los comprobantes del proyecto. Configura las variables `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` en el entorno del backend. Los comprobantes aceptados son PDF, JPG y PNG, con un máximo de 5 MB.

Los datos para transferencias son opcionales y se leen desde `DEPOSIT_BANK_NAME`, `DEPOSIT_BENEFICIARY` y `DEPOSIT_CLABE`. Si no están configurados, la API informa al frontend y no muestra datos bancarios.

La aprobación registra en una transacción MongoDB el cambio de estado del depósito, el crédito de Wallet y su movimiento `DEPOSIT_CONFIRMED`. Por ello, MongoDB debe operar como replica set (o `mongos`); si no soporta transacciones, la API rechaza la aprobación y no cambia el saldo.
# Motor de apuestas

## Decisiones y dinero

El módulo de apuestas escribe importes en **centavos enteros**. El `Wallet.balanceCents` existente sigue siendo el saldo disponible; `reservedBalanceCents` contiene órdenes pendientes de cotejo e `inPlayBalanceCents` los riesgos ya cotejados. El saldo histórico se conserva como disponible durante el backfill.

- **Parejo (`EVEN`)**: cada lado arriesga la misma cantidad. La ganancia bruta potencial del ganador es igual a su propio riesgo; su retorno total es capital devuelto + ganancia bruta.
- **Doy 80 (`GIVE_80`)**: por cada unidad de emparejamiento se arriesgan $100.00 (10,000 centavos) para ganar $80.00 (8,000 centavos).
- **Agarro 80 (`TAKE_80`)**: por cada unidad se arriesgan $80.00 para ganar $100.00.
- Cada unidad `GIVE_80` debe ser un múltiplo de 10,000 centavos y cada unidad `TAKE_80` de 8,000 centavos. Los remanentes menores quedan pendientes; no se crean fracciones de centavo. Los emparejamientos parciales respetan el mismo ratio.
- Los cotejos se toman por `createdAt` ascendente y `_id` ascendente. No se cotejan órdenes del mismo usuario.
- La comisión se configura en **Reglas de apuestas** (solo ADMIN), se expresa como porcentaje de la ganancia bruta del ganador y nunca se descuenta del capital devuelto. Al abrir el mercado se copia a la pelea y queda fija hasta liquidarla. Si aún no existe una configuración guardada, se conserva `BET_COMMISSION_BPS` como valor inicial/fallback (por defecto `0`, máximo `10000`). Se redondea al centavo más cercano, empate hacia arriba.
- El monto mínimo global de las nuevas apuestas también se administra en **Reglas de apuestas**, se guarda en MongoDB y por defecto es $1 MXN. “Doy 80” y “Agarro 80” además deben respetar sus múltiplos de $100 y $80, redondeando hacia arriba el mínimo efectivo para cada modalidad.

Todas las acciones financieras y el estado de la pelea se escriben en transacciones MongoDB. Se requiere replica set o `mongos`. Un registro `WalletTransaction` documenta cada reserva, cambio de bucket, liberación, devolución de capital, ganancia, pérdida o comisión. `balanceBeforeCents` y `balanceAfterCents` representan el saldo disponible; el detalle de los tres buckets queda en `metadata`. Las ganancias y liberaciones usan tipos distintos.

## API

Las rutas se montan bajo `/api` y requieren JWT. Los endpoints de operación y administración requieren `ADMIN` o `OPERADOR`; las órdenes y cancelaciones son propias del usuario autenticado. Importes de entrada y salida se expresan en centavos.

| Método y ruta | Uso |
| --- | --- |
| `POST /fights/:fightId/bets` | Crear y cotejar una orden. Payload: `{ "participantSide": "RED", "marketType": "EVEN", "riskCents": 1200000 }`. |
| `GET /fights/:fightId/bets/market` | Sumas del mercado pendiente y de los cotejos. |
| `GET /fights/:fightId/my-bets` | Órdenes, cotejos y buckets de wallet del usuario en esa pelea. |
| `GET /my-bets` | Órdenes y cotejos propios recientes. |
| `GET /fights/open-bets` | Peleas que aceptan órdenes. |
| `GET /bets/:betId` | Detalle propio (operadores pueden consultar cualquier orden). |
| `POST /bets/:betId/cancel-pending` | Liberar solo el remanente no cotejado mientras el mercado esté abierto. |
| `POST /fights/:fightId/betting/open` | Abrir el mercado de una pelea programada. |
| `POST /fights/:fightId/betting/close` | Cerrar atómicamente, liberar pendientes y pasar cotejos a `IN_PLAY`. |
| `POST /fights/:fightId/start` | Iniciar una pelea después de confirmar que el mercado ya está cerrado. |
| `POST /fights/:fightId/bets/settle` | Liquidar: `{ "outcome": "RED" }`, `GREEN`, `DRAW` o `CANCELLED`. Se aceptan `fightStats` opcionales para duración y puntuaciones. |
| `GET /admin/bets` | Órdenes con filtros y paginación (`page`, `limit`, `eventId`, `fightId`, `userId`, `participantSide`, `marketType`, `status`, `from`, `to`). |
| `GET /admin/bet-matches` | Cotejos con filtros equivalentes y paginación. |
| `GET /admin/bet-audit/:referenceId/transactions` | Movimientos inmutables asociados a una orden o cotejo. |

Ejemplo de respuesta al crear una orden: `{ "success": true, "data": { "order": { "requestedRiskAmount": 1200000, "matchedRiskAmount": 1000000, "pendingRiskAmount": 200000, "status": "PARTIALLY_MATCHED" }, "matches": [], "wallet": { "availableBalance": 800000, "reservedBalance": 200000, "inPlayBalance": 1000000 } } }`.

La operación de resultado del frontend de peleas usa el endpoint de liquidación. Las modificaciones REST genéricas de `apuestasAbiertas`, `bettingStatus` y `resultado` se rechazan para evitar cambiar el estado financiero sin ledger.

## Despliegue y backfill

Antes de abrir apuestas en una base ya existente, configura MongoDB como replica set y ejecuta desde este proyecto:

```sh
npm run wallet:betting-backfill
npm run betting:indexes
```

El primer comando inicializa buckets reservados/en juego en cero y traduce `apuestasAbiertas` heredado a `bettingStatus`, sin modificar `balanceCents`. El segundo crea índices FIFO, referencias e idempotencia. Si la configuración de comisión aún no se guarda desde administración, el valor inicial se toma de `BET_COMMISSION_BPS`; el valor predeterminado de código no cobra comisión.

Las pruebas unitarias funcionan con `npm test`. La suite de servicio transaccional requiere una URI de réplica aislada cuyo nombre de base incluya `betting_test`; la suite crea y elimina únicamente `betting_test_<pid>`:

```sh
BETTING_TEST_MONGO_URI='mongodb://127.0.0.1:27017/betting_test?replicaSet=rs0' npm test
```

## Pantallas Angular

En `front-admin`, `/bets` muestra peleas abiertas y las apuestas recientes del usuario; `/bets/:fightId` contiene la boleta y los cotejos propios; `operation-events` tiene controles de apertura/cierre y resumen; `/bet-audit` relaciona órdenes, cotejos y WalletTransactions sin mostrar datos de contrapartes en el flujo del apostador.
