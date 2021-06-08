import puppeteer from 'puppeteer';
import ExcelJS from 'exceljs';
import path from 'path';
import moment from 'moment';

const mainPage = 'https://bj.lianjia.com/ershoufang/ie2f2f5lc1lc2lc3lc5dp1dp2l2a3bp400ep650/';
/**
 * 
 * 70~90平
 * https://bj.lianjia.com/ershoufang/ie2f2f5lc1lc2lc3lc5dp1dp2l2a3bp400ep650/
 * 
 * 90~120平 二居
 * https://bj.lianjia.com/ershoufang/ie2f2f5lc1lc2lc3lc5dp1dp2l2a4bp400ep650/
 * 
 *  */

const data = [
    { name: '70~90平二居', key: 'ie2f2f5lc1lc2lc3lc5dp1dp2l2a3bp400ep650' },
    { name: '90~120平二居', key: 'ie2f2f5lc1lc2lc3lc5dp1dp2l2a4bp400ep650' },
]
const getPage = function (index: number, key: string) {
    return `https://bj.lianjia.com/ershoufang/${index > 1 ? 'pg' + index : ''}${key}/`;
};

const getDetailInfo = async function (info1: any, detailPage: puppeteer.Page) {
    const { link } = info1;
    await detailPage.goto(link);
    try {
        await detailPage.waitForSelector('#mapListContainer li', { timeout: 5000 });
    } catch (e) { }
    const info2 = await detailPage.$$eval('.introContent .content ul li,.transaction .content ul li', (list) => {
        return {
            insideArea: list[4]?.childNodes[1].textContent,
            liftRate: list[9]?.childNodes[1].textContent,
            warm: list[10]?.childNodes[1].textContent,
            saleTime: list[12]?.childNodes[3].textContent,
            transOwn: list[13]?.childNodes[3].textContent,
            duration: list[16]?.childNodes[3].textContent,
        }
    });
    const info3 = await detailPage.$eval('body', (body) => {
        const smallPicArr = body.querySelector('.newwrap .layout .content img')?.getAttribute('src')?.split('.') || [];
        smallPicArr[length - 2] = '720x540';
        return {
            pic: smallPicArr.join('.'),
            totalPrice: body.querySelector('.price .total')?.textContent,
            unitPrice: body.querySelector('.price .unitPriceValue')?.textContent,
            firstPrice: body.querySelector('.result-text .shoufu-item .content')?.textContent,
            pureFirstPrice: body.querySelector('.result-text .jing-item .content')?.textContent,
            monthlyPrice: body.querySelector('.result-text .yuegong-item .content')?.textContent,
            // subway: body.querySelector('#mapListContainer li[data-index="subway0"]')?.parentElement?.textContent?.trim().split(' ').join('\n') || '-',
            division: body.querySelector('.areaName .info')?.childNodes[0]?.textContent || '-',
            ring: body.querySelector('.areaName .info')?.childNodes[3]?.textContent || '-',
            subway: body.querySelector('#mapListContainer li[data-index="subway0"]')?.parentElement?.textContent?.trim() || '-',
        }
    });
    const info = { ...info1, ...info2, ...info3 };
    // console.log(JSON.stringify(info, null, 2));
    return info;
};

const spiderRun = async (conf: { name: string, key: string }) => {
    const browser = await puppeteer.launch();
    const listPage = await browser.newPage();
    const detailPage = await browser.newPage();
    await listPage.goto(getPage(1, conf.key));
    console.log('launch');
    // 获取页数
    const pageData = await listPage.$eval('.page-box .house-lst-page-box', dom => dom.getAttribute('page-data'));
    if (!pageData) return;
    const { totalPage } = JSON.parse(pageData);
    console.log({ pageData });
    const data = [];
    /**
     * 从1开始，遍历，获取信息：
     * 小区、地区、面积、朝向、楼层、年份、类型、链接
     * 套内面积、梯户比、暖气、挂牌时间、权属、年限
     * 户型图
     * 总价、单价、首付、净首付、月供
     * 行政区、环线、地铁信息
     */
    for (let i = 1; i <= totalPage; i++) {
        await listPage.goto(getPage(i, conf.key));
        console.log(`At page: ${i}`);
        const arr = await listPage.$$eval('.sellListContent>li.clear', (list) => {
            return list.map((dom) => {
                const [block, area] = dom.querySelector('.positionInfo')?.textContent?.split('-') || [];
                const link = dom.querySelector('.title a')?.getAttribute('href') || '';
                const [_a, square, pos, _b, floor, time, type] = dom.querySelector('.houseInfo')?.textContent?.split('|') || [];
                return { block, area, square, pos, floor, time, type, link };
            });
        });
        // console.log(JSON.stringify(arr, null, 2));
        for (let j = 0; j < arr.length; j++) {
            console.log(`At list: ${j}`);
            try {
                data.push(await getDetailInfo(arr[j], detailPage));
            } catch (e) {
                console.log('Failed!==============================');
                console.log(arr[j]);
                console.log('=====================================');
            }
        }
    }

    const workbook = new ExcelJS.Workbook;
    const sheet = workbook.addWorksheet('sheet1');
    const tableName = {
        block: '小区',
        area: '地区',
        square: '建筑面积（平米）',
        pos: '朝向',
        floor: '总楼层',
        time: '建成时间',
        type: '建筑类型',
        link: '链接地址',
        insideArea: '套内面积（平米）',
        liftRate: '梯户比',
        warm: '供暖方式',
        saleTime: '挂牌时间',
        transOwn: '交易权属',
        duration: '房屋年限',
        pic: '房型图',
        totalPrice: '总价（万元）',
        unitPrice: '单价（元）',
        firstPrice: '首付（万元）',
        pureFirstPrice: '纯首付（税前）（万元）',
        monthlyPrice: '月供（元）',
        division: '行政划分',
        ring: '环线',
        subway: '地铁信息'
    };
    sheet.columns = Object.keys(tableName).map((key) => {
        if (key === 'subway') {
            return { header: key, key, width: 100 };
        }
        return { header: key, key };
    });
    {
        const row = sheet.getRow(1);
        Object.keys(tableName).forEach((key) => { row.getCell(key).value = (tableName as any)[key] });
    }
    data.forEach((info, index) => {
        const row = sheet.getRow(index + 2);
        sheet.columns.forEach(({ key }) => {
            if (!key) return;
            if (key === 'link') {
                row.getCell(key).value = { text: String(info[key]).trim(), hyperlink: String(info[key]) };
            } else if (
                ['square', 'insideArea', 'totalPrice', 'unitPrice', 'firstPrice', 'pureFirstPrice', 'monthlyPrice'].includes(key)
            ) {
                const value = String(info[key]).trim().match(/\d+(\.\d+)?/g) || [''];
                row.getCell(key).value = Number(value[0]);
            } else {
                row.getCell(key).value = String(info[key]).trim();
            }
            if (key === 'subway') {
                row.getCell(key).alignment = { wrapText: true };
            }
        });
    });
    workbook.xlsx.writeFile(path.resolve(`./data/${conf.name}_${moment().format('YYYYMMDD_HHmmss')}.xlsx`));
    console.log("Gen excel!");
    browser.close();
};

data.forEach((conf) => {
    spiderRun(conf);
});