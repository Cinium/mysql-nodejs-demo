const mysql = require('mysql2');
const express = require('express');
const {
	formatDate,
	calculateDiff,
	createUniqueValuesObj,
	calculateFinalBalance,
	createReportMovementArr,
} = require('./helpers');

const app = express();
const urlencodedParser = express.urlencoded({ extended: false });

const pool = mysql
	.createPool({
		connectionLimit: 5,
		dateStrings: true,
		host: 'localhost',
		database: 'mysql_test',
		user: 'root',
		password: '',
	})
	.promise();

app.set('view engine', 'hbs');

/* ----------- Express запросы ----------- */

// главная страница
app.get('/', (req, res) => {
	res.render('index.hbs');
});

// получение контрагентов
app.get('/counterparties', (req, res) => {
	pool
		.query('SELECT * FROM counterparties')
		.then(data => res.render('counterparties.hbs', { counterparties: data[0] }))
		.catch(err => console.log(err));
});

// получение номенклатур
app.get('/nomenclature', (req, res) => {
	pool
		.query('SELECT * FROM nomenclature')
		.then(data => res.render('nomenclature.hbs', { nomenclature: data[0] }))
		.catch(err => console.log(err));
});

// получение поставок
app.get('/deliveries', (req, res) => {
	pool
		.query('SELECT * FROM deliveries')
		.then(data => res.render('deliveries.hbs', { deliveries: data[0] }))
		.catch(err => console.log(err));
});

app.get('/sales', (req, res) => {
	pool
		.query('SELECT * FROM sales')
		.then(data => res.render('sales.hbs', { sales: data[0] }))
		.catch(err => console.log(err));
});

app.get('/reports', (req, res) => {
	res.render('reports.hbs');
});

app.post('/', urlencodedParser, async (req, res) => {
	await createTables();
	res.render('index.hbs');
});

app.post('/reports', urlencodedParser, async (req, res) => {
	let { start_date, end_date } = req.body;
	start_date = formatDate(start_date);
	end_date = formatDate(end_date);

	const movements = await reportMovementsForPeriod(start_date, end_date);
	const gross = await reportGrossProfit(start_date, end_date);
	res.render('reports.hbs', { gross, movements, start_date, end_date });
});

// добавление поступления (надо переименовать deliveries во что-то более подходящее)
app.post('/deliveries', urlencodedParser, async (req, res) => {
	if (!req.body) return res.sendStatus(400);
	let {
		supplier,
		nomenclature,
		price,
		total,
		quantity,
		date = Date.now(),
	} = req.body;

	try {
		const supplierId = await getCounterpartyIdByName(supplier);
		const nomenclatureId = await getNomenclatureIdByName(nomenclature);

		if (total && !price) price = total / quantity;
		else if (!total && price) total = price * quantity;
		else if (!total && !price) throw Error('Бесценно??');

		await insertIntoDeliveries([
			supplierId,
			nomenclatureId,
			quantity,
			price,
			total,
			date ? date : formatDate(Date.now()),
		]);

		res.redirect('/deliveries');
	} catch (err) {
		console.log(err);
	}
});

// добавление продажи товара
app.post('/sales', urlencodedParser, async (req, res) => {
	if (!req.body) return res.sendStatus(400);
	let { buyer, nomenclature, price, quantity, total, date } = req.body;

	try {
		const buyerId = await getCounterpartyIdByName(buyer);
		const nomenclatureId = await getNomenclatureIdByName(nomenclature);

		if (total && !price) price = total / quantity;
		else if (!total && price) total = price * quantity;
		else if (!total && !price) throw Error('Бесценно??');

		await insertIntoSales([
			buyerId,
			nomenclatureId,
			quantity,
			price,
			total,
			date ? date : formatDate(Date.now()),
		]);
		res.redirect('/sales');
	} catch (err) {
		console.log(err);
	}
});

// запрос на добавление контрагента
app.post('/counterparties', urlencodedParser, (req, res) => {
	if (!req.body) return res.sendStatus(400);
	addCounterparty(req.body.name);
	res.redirect('/counterparties');
});

// запрос на добавление номенклатуры
app.post('/nomenclature', urlencodedParser, (req, res) => {
	if (!req.body) return res.sendStatus(400);
	const { name, quantity } = req.body;
	addNomenclature(name, quantity);
});

// удаление поставки
app.post('/deliveries/:id', (req, res) => {
	const id = req.params.id;
	pool.query('DELETE FROM deliveries WHERE id=?', [id], (err, data) => {
		if (err) return console.log(err);
	});
	res.redirect('/deliveries');
});

// удаление продажи
app.post('/sales/:id', (req, res) => {
	const id = req.params.id;
	pool.query('DELETE FROM sales WHERE id=?', [id], (err, data) => {
		if (err) return console.log(err);
	});
	res.redirect('/sales');
});

/* ---------- дополнительные функции ---------- */

const createTables = async () => {
	pool.query(
		`CREATE TABLE IF NOT EXISTS counterparties 
		(id INT AUTO_INCREMENT PRIMARY KEY, 
		counterparty_name VARCHAR(100) NOT NULL UNIQUE)`
	);
	pool.query(
		`CREATE TABLE IF NOT EXISTS nomenclature 
		(id INT AUTO_INCREMENT PRIMARY KEY,
		nomenclature_name VARCHAR(100) NOT NULL unique)`
	);
	pool.query(
		`CREATE TABLE IF NOT EXISTS sales 
		(id INT PRIMARY KEY AUTO_INCREMENT,
		buyer_id INT, 
		nomenclature_id INT,
		nomenclature_quantity INT NOT NULL,
		nomenclature_price DECIMAL(65, 3),
		total_price DECIMAL(65, 3),
		sale_date DATE NOT NULL,
		FOREIGN KEY (buyer_id) REFERENCES counterparties (id),
		FOREIGN KEY (nomenclature_id) REFERENCES nomenclature (id))`
	);
	pool.query(
		`CREATE TABLE IF NOT EXISTS deliveries 
		(id INT PRIMARY KEY AUTO_INCREMENT,
		supplier_id INT, 
		nomenclature_id INT,
		nomenclature_quantity INT NOT NULL,
		nomenclature_price DECIMAL(65, 3),
		total_price DECIMAL(65, 3),
		delivery_date DATE,
		FOREIGN KEY (supplier_id) REFERENCES counterparties (id),
		FOREIGN KEY (nomenclature_id) REFERENCES nomenclature (id)
	)`
	);
};

// добавление контрагента
const addCounterparty = async name => {
	try {
		const res = await pool.query(
			'INSERT IGNORE INTO counterparties (counterparty_name) VALUES (?)',
			[name]
		);
		return res[0].insertId;
	} catch (err) {
		console.log(err);
	}
};

// добавление номенклатуры
const addNomenclature = async (name, quantity = 0) => {
	try {
		const res = await pool.query(
			'INSERT IGNORE INTO nomenclature (nomenclature_name, quantity) VALUES (?, ?)',
			[name, quantity]
		);
		return res[0].insertId;
	} catch (err) {
		console.log(err);
	}
};

// отчет по движениям за период
const reportMovementsForPeriod = async (start, end) => {
	try {
		// Начальный остаток
		const deliveriesBeforeStart = await selectDeliveriesUntil(start);
		const salesBeforeStart = await selectSalesUntil(start);
		const openingBalance = calculateDiff(
			deliveriesBeforeStart,
			salesBeforeStart
		);

		// Приход
		const deliveries = await selectDeliveriesBetween(start, end);
		const deliveriesObj = createUniqueValuesObj(deliveries);

		// Расход
		const sales = await selectSalesBetween(start, end);
		const salesObj = createUniqueValuesObj(sales);

		// Конечный остаток
		/*
		 * в таблице с примером, возможно, ошибка:
		 * если "Приход" — это поставка товара нам,
		 * то мы тратим на него указанную сумму?
		 * поэтому должно происходить вычитание суммы из начального остатка,
		 * С "Расходом" аналогично, но соотвественно инвертированно
		 * В итоге сумма конечного остатка должна быть (нач.ост. - приход + расход)
		 * нам пришел товар => минус деньги; от нас ушел товар => плюс деньги
		 * В таблице же получается кон.ост. = (нач.ост. + приход - расход)
		 * Или я чего-то не понимаю((
		 */
		const finalBalance = calculateFinalBalance(
			openingBalance,
			deliveriesObj,
			salesObj
		);

		const reportArr = await createReportMovementArr(
			openingBalance,
			deliveriesObj,
			salesObj,
			finalBalance
		);
		return reportArr;
	} catch (err) {
		console.log(err);
	}
};

const reportGrossProfit = async (start, end) => {
	// расход за период
	const sales = await selectSalesBetween(start, end);
	const soldGoods = createUniqueValuesObj(sales); // кол-во и сумма продажи

	const deliveries = await selectDeliveriesUntil(end);
	const uniqueDeliveries = createUniqueValuesObj(deliveries);

	const costPrices = {};
	for (let id in uniqueDeliveries) {
		if (Object.keys(soldGoods).includes(id)) {
			costPrices[id] =
				(uniqueDeliveries[id].amount / uniqueDeliveries[id].quantity) *
				soldGoods[id].quantity;
		}
	}

	const resArr = [];
	let totalAmount = 0,
		totalCostPrice = 0,
		totalProfit = 0;

	for (let id in soldGoods) {
		resArr.push({
			nomenclature: await getNomenclatureNameById(id),
			sold: soldGoods[id].quantity,
			amount: soldGoods[id].amount,
			costPrice: costPrices[id].toFixed(3),
			profit: (soldGoods[id].amount - costPrices[id]).toFixed(3),
		});
		totalAmount += soldGoods[id].amount;
		totalCostPrice += costPrices[id];
		totalProfit += soldGoods[id].amount - costPrices[id];
	}
	resArr.push({
		nomenclature: 'Итого',
		sold: '',
		amount: totalAmount,
		costPrice: totalCostPrice.toFixed(3),
		profit: totalProfit.toFixed(3),
	});
	return resArr;
};

const selectDeliveriesUntil = async start => {
	const [res] = await pool.query(
		`SELECT nomenclature_id, nomenclature_quantity, nomenclature_price
			FROM deliveries WHERE delivery_date < STR_TO_DATE('${start}', '%Y-%m-%d')`
	);

	return res;
};
const selectDeliveriesBetween = async (start, end) => {
	const [res] = await pool.query(
		`SELECT nomenclature_id, nomenclature_quantity, nomenclature_price
		FROM deliveries
		WHERE delivery_date
		BETWEEN STR_TO_DATE('${start}', '%Y-%m-%d')
		AND STR_TO_DATE('${end}', '%Y-%m-%d')`
	);

	return res;
};

const selectSalesUntil = async start => {
	const [res] = await pool.query(
		`SELECT nomenclature_id, nomenclature_quantity, nomenclature_price
			FROM sales WHERE sale_date < STR_TO_DATE('${start}', '%Y-%m-%d')`
	);

	return res;
};

const selectSalesBetween = async (start, end) => {
	const [res] = await pool.query(
		`SELECT nomenclature_id, nomenclature_quantity, nomenclature_price
		FROM sales
		WHERE sale_date
		BETWEEN STR_TO_DATE('${start}', '%Y-%m-%d')
		AND STR_TO_DATE('${end}', '%Y-%m-%d')`
	);

	return res;
};

const insertIntoDeliveries = async values => {
	await pool.query(
		`INSERT INTO deliveries (
			supplier_id,
			nomenclature_id,
			nomenclature_quantity,
			nomenclature_price,
			total_price,
			delivery_date
		) VALUES (?, ?, ?, ?, ?, ?)`,
		values
	);
};

const insertIntoSales = async values => {
	await pool.query(
		`INSERT INTO sales (
			buyer_id,
			nomenclature_id,
			nomenclature_quantity,
			nomenclature_price,
			total_price,
			sale_date
		) VALUES (?, ?, ?, ?, ?, ?)`,
		values
	);
};

/* по имени контрагента возвращается его id
 * если контрагента нет, он создается и возвращается id
 */
const getCounterpartyIdByName = async name => {
	let [id] = await pool.query(
		`SELECT id FROM counterparties WHERE counterparty_name = ?`,
		[name]
	);
	if (id[0]) return id[0].id;
	id = await addCounterparty(name);
	return id;
};

/* по имени номенклатуры возвращается его id
 * если номенклатуры нет, он создается и возвращается id
 */
const getNomenclatureIdByName = async name => {
	let [id] = await pool.query(
		`SELECT id FROM nomenclature WHERE nomenclature_name = ?`,
		[name]
	);
	if (id[0]) return id[0].id;
	id = await addNomenclature(name);
	return id;
};

/* по id номенклатуры возвращается его имя
 */
const getNomenclatureNameById = async id => {
	let [name] = await pool.query(
		`SELECT nomenclature_name FROM nomenclature WHERE id = ?`,
		[id]
	);
	if (name[0]) return name[0].nomenclature_name;
};

exports.getNomenclatureNameById = getNomenclatureNameById;

/* ----------- прослушка сервера --------- */

app.listen(3000, function () {
	console.log('Server is runing on http://localhost:3000/');
});
