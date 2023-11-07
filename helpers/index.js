const main = require("../index.js");

/*
 * функция из массива данных из БД пересобирает объект объектов
 * (так удобнее перебирать все данные)
 *
 * {
 * 	айдиТовара: {
 * 		nomenclature_id: айди,
 * 		quantity: количество товара,
 * 		amount: себестоимость этого количества
 *  },
 * }
 */
function createUniqueValuesObj(array) {
	const obj = {};

	array.forEach(el => {
		const id = el['nomenclature_id'];
		if (!obj[id])
			obj[id] = {
				nomenclature_id: id,
				quantity: el.nomenclature_quantity,
				amount: el.nomenclature_quantity * el.nomenclature_price,
			};
		else {
			obj[id].quantity += el.nomenclature_quantity;
			obj[id].amount += el.nomenclature_quantity * el.nomenclature_price;
		}
	});
	return obj;
}

/* функция вычисляет разницу между приходом и расходом и собирает всё в объект
 */
function calculateDiff(firstArr, secArr) {
	const a = createUniqueValuesObj(firstArr);
	const b = createUniqueValuesObj(secArr);

	return mergeObjects(a, b, { abs: true });
}

// расчет финального остатка для отчета
function calculateFinalBalance(opening, income, outcome) {
	const openNIncomeObj = mergeObjects(opening, income, { q: true });
	const finalBalance = mergeObjects(openNIncomeObj, outcome, { a: true });
	return finalBalance;
}

/*
 * функция для слияния двух объектов с полями quantity и amount
 * принимает третьим аргументом объект параметров
 * q: true | false // отвечает за знак при слиянии полей quantity
 * a: true | false // отвечает за знак при слиянии полей amount
 * abs: true | false // абсолютное значение полей
 */
function mergeObjects(first, second, { q, a, abs }) {
	const combined = { ...first, ...second };
	const firstKeys = Object.keys(first);
	const secKeys = Object.keys(second);
	const entries = Object.entries(combined);

	const res = entries.reduce((acc, [key, value]) => {
		if (firstKeys.includes(key) && secKeys.includes(key)) {
			acc[key] = {
				...value,
				quantity: q
					? first[key].quantity + second[key].quantity
					: first[key].quantity - second[key].quantity,
				amount: a
					? first[key].amount + second[key].amount
					: first[key].amount - second[key].amount,
			};
			if (abs) {
				acc[key].quantity = Math.abs(acc[key].quantity);
				acc[key].amount = Math.abs(acc[key].amount);
			}
		} else acc[key] = value;
		return acc;
	}, {});

	return res;
}

// создает массив для репорта по движениям товаров для отчета
async function createReportMovementArr(
	openingBalance,
	deliveries,
	sales,
	finalBalance
) {
	// Собираем все данные в массив
		// каждый объект в массиве — строка из отчета
		const reportArr = [];
		const totalObj = {
			// дополнительный объект с итоговыми суммами
			nomenclature: 'Итого',
			openingQ: '',
			openingA: 0,
			incomeQ: '',
			incomeA: 0,
			outcomeQ: '',
			outcomeA: 0,
			finalQ: '',
			finalA: 0,
		};

		for (let id in finalBalance) {
			reportArr.push({
				nomenclature: await main.getNomenclatureNameById(id),
				openingQ: openingBalance[id]?.quantity || 0,
				openingA: openingBalance[id]?.amount || 0,
				incomeQ: deliveries[id]?.quantity || 0,
				incomeA: deliveries[id]?.amount || 0,
				outcomeQ: sales[id]?.quantity || 0,
				outcomeA: sales[id]?.amount || 0,
				finalQ: finalBalance[id]?.quantity || 0,
				finalA: finalBalance[id]?.amount || 0,
			});
			totalObj.openingA += openingBalance[id]?.amount || 0;
			totalObj.incomeA += deliveries[id]?.amount || 0;
			totalObj.outcomeA += sales[id]?.amount || 0;
			totalObj.finalA += finalBalance[id]?.amount || 0;
		}

		reportArr.push(totalObj);
		return reportArr
}

// объект в массив 🤷‍♂️
function objToArray(obj) {
	const array = [];
	for (i in obj) array.push(obj[i]);

	return array;
}

// форматирование даты
const formatDate = date => {
	let d = new Date(date),
		month = '' + (d.getMonth() + 1),
		day = '' + d.getDate(),
		year = d.getFullYear();
	if (month.length < 2) month = '0' + month;
	if (day.length < 2) day = '0' + day;

	return [year, month, day].join('-');
};

module.exports = {
	formatDate,
	calculateDiff,
	createUniqueValuesObj,
	objToArray,
	calculateFinalBalance,
	createReportMovementArr
};
