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
