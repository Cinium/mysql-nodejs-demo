
# MySQL + NodeJS demo

���� �� MySQL � ������ � NodeJS (Express) � �������� hbs


## ���������

��� ������ �����������:
* ��������� MySQL ������ (������ 8+), ����� � open server ��������� ��� ����� MySQL Workbench
* NodeJs � �������� ���������� npm ([���](https://nodejs.org/en/download))
* Git (����������)
---
1. ������ ����� ��������� ����������� �� ������
```
git clone https://github.com/Cinium/mysql-nodejs-demo.git
cd mysql-nodejs-demo
```
2. ������������� ����������� ������ (�� ����� �������)

```bash
  npm install
```
3. ������� � ��������� ��������� �� MySQL
4. � `/index.js` � ������� `mysql.createPool` (14 ������) ������ ��������  `database`, `user`, `password` �� ����
5. ��������� ��� � �������
```
npm run start
```
6. ��������� � �������� `http://localhost:3000/`


### � ������� ���-���������� � �������� ����� ������ ��������� �� � ����������� ������