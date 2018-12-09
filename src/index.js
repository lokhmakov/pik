import uuid                 from 'uuid/v4'
import Grid                 from '@material-ui/core/Grid'
import { MapMarker }        from 'mdi-material-ui'
import React, { Component } from 'react'
import ReactDOM             from 'react-dom'
import compose              from 'recompose/compose'
import lifecycle            from 'recompose/lifecycle'
import withHandlers         from 'recompose/withHandlers'
import withStateHandlers    from 'recompose/withStateHandlers'
import withPropsOnChange    from 'recompose/withPropsOnChange'
import { YMaps }            from 'react-yandex-maps'
import { Map }              from 'react-yandex-maps'
import { Placemark }        from 'react-yandex-maps'
import { RouteEditor }      from 'react-yandex-maps'
import { ObjectManager }    from 'react-yandex-maps'
import { Icon }             from 'semantic-ui-react'
import { Button }           from 'semantic-ui-react'
import { Table }            from 'semantic-ui-react'
import { Header }           from 'semantic-ui-react'
import { DateInput }        from 'semantic-ui-calendar-react'
import { Tab }              from 'semantic-ui-react'
import styled               from 'styled-components'
import moment               from 'moment'
 

import factoryQuery         from 'factory/api/query'
import factoryContrstructionLengthQuery from 'factoryContrstructionLength/api/query'
import transportTaskQuery   from 'transportTask/api/query'
import transportStatusType  from 'transportTask/api/transportStatusMap'

import Marker               from 'yandex/web/Marker'
import Route                from 'yandex/web/Route'

moment.locale('ru')

const positionMap = {
  Leuven: [50.879, 4.6997],
  Lebanon: [33.888630, 35.495480],
  Moscow: [55.75, 37.57],
}

const transportMap = {
  301: `У-230`,
  302: `КАССЕТНИК`,
  303: `20 ТНН`,
  304: `НАКЛОННИК`,
  305: `НИЗКОРАМНИК`,
  306: `ПЛОЩАДКА 30ТН.`,
  307: `КОРЗИНА`,
  308: `ПЛОЩАДКА`,
  309: `ПАНЕЛЕВОЗ`,
  310: `ИНЛОУДЕР`,
  311: `БОРТОВАЯ`,
}

const LENGTH_MAX = 12
// NOT TASKS FOR SUCH TYPE OF TRANSPORT

const getShortTask = (payload) => {
  const { transportTask } = payload
  const { fCLengthIndex } = payload
  const { timeWindowMap } = payload

  // Index factory available to transportTaskId map
  // const factoryIdAvailableMap = Object.keys(transportTask).reduce((acc, id) => {
  //   const { factoryId, status } = transportTask[id]
  //   if (status !== transportStatusType.DONE) {
  //     acc[factoryId] = {
  //       ...(acc[factoryId] || {}),
  //       [id]: true,
  //     }
  //   }
  //   return acc
  // }, {})

  // // Index construction avaliable to transportTaskId map
  // const constructionIdAvailableMap = Object.keys(transportTask).reduce((acc, id) => {
  //   const { constructionId, status } = transportTask[id]
  //   if (status !== transportStatusType.DONE) {
  //     acc[constructionId] = {
  //       ...(acc[constructionId] || {}),
  //       [id]: true
  //     }
  //   }
  //   return acc
  // }, {})

  // let length = null
  // let transportTaskMap = null
  // for (let factoryId in factoryIdAvailableMap) {
  //   for (let constructionId in constructionIdAvailableMap) {
  //     if (length === null) {
  //       length = fCLengthIndex[factoryId][constructionId]

  //       if (!length) {
  //         console.warn(`ERROR CANNOT ACCESS LENGTH FOR FACTORY`, factoryId, `CONSTRUCTION`, constructionId)
  //       }
  //       // console.log(`factoryId`, factoryId)
  //       // console.log(`constructionId`, constructionId)
  //       // console.log(`length`, length)
  //       transportTaskMap = factoryIdAvailableMap[factoryId]
  //     } else {
  //       if (length > fCLengthIndex[factoryId][constructionId]) {
  //         length = fCLengthIndex[factoryId][constructionId]
  //         transportTaskMap = factoryIdAvailableMap[factoryId]
  //       }
  //     }
  //   }
  // }



  // console.log(`factoryIdAvailableMap`, factoryIdAvailableMap)
  // console.log(`constructionIdAvailableMap`, constructionIdAvailableMap)
  // console.log(`fCLengthIndex`, fCLengthIndex)
  // console.log(`LENGTH`, length)
  // console.log(`transportTaskMap`, transportTaskMap)

  let length = null
  let transportId = null
  let windowOffset = null
  let windowOffsetCurrent = null
  for (let id of Object.keys(transportTask)) {
    const doc = transportTask[id]

    if (doc.status === transportStatusType.DONE) {
      continue
    }

    const { factoryId, constructionId } = doc

    const timeWindowCurrent = timeWindowMap[doc.constructionId]

    windowOffset = timeWindowCurrent[0] > fCLengthIndex[doc.factoryId][doc.constructionId]
      ? timeWindowCurrent[0] - fCLengthIndex[doc.factoryId][doc.constructionId]
      : 0

    // console.log(`WINDOWS_OFFSET`, windowOffset)

    if (length === null) {
      length = fCLengthIndex[factoryId][constructionId] + windowOffset
      windowOffsetCurrent = windowOffset
      transportId = id

      if (!length) {
        console.warn(`ERROR CANNOT ACCESS LENGTH FOR FACTORY`, factoryId, `CONSTRUCTION`, constructionId)
      }
    } else {
      if (length > fCLengthIndex[factoryId][constructionId] + windowOffset) {
        transportId = id
        windowOffsetCurrent = windowOffset
        length = fCLengthIndex[factoryId][constructionId] + windowOffset
      }
    }
  }

  const transportTaskId = transportId
  const { constructionId, transportType } = transportTask[transportTaskId]

  const transportDoc = {
    id: uuid(),
    transportType,
    dailyOffset: windowOffsetCurrent,
    dailyLength: length,
    runQuantity: 1,
    transportTaskMap: [
      {
        transportTaskId,
        length: length - windowOffsetCurrent,
        windowOffset: 0,
      },
    ],
  }

  return {
    constructionId,
    length,
    transportDoc,
    transportTaskId,
  }
}

// Вычислить кратчайший рейс на основании строительной площадки где находится машина
const getShortTaskBasedOnConstructionId = (payload, options = {}) => {
  const { transportTask } = payload
  const { fCLengthIndex } = payload
  const { cFLengthIndex } = payload
  const { constructionId } = payload
  const { transportDoc } = payload

  const { transportType } = transportDoc
  const { dailyLength } = transportDoc
  const { runQuantity } = transportDoc
  const { timeWindowMap } = payload


  let length = null
  let transportId = null
  let lengthReturn = null
  let lengthReturnCurrent = null
  let windowOffset = null
  let windowOffsetCurrent = null

  // console.log(`CONSTRUCTION_ID XXX`, constructionId)


  for (let id of Object.keys(transportTask)) {
    const doc = transportTask[id]

    if (doc.status === transportStatusType.DONE || doc.transportType !== transportType) {
      continue
    }

    const { factoryId } = doc
    const timeWindowCurrent = timeWindowMap[doc.constructionId]

    lengthReturn = cFLengthIndex[constructionId][factoryId]

    if (!lengthReturn) {
      console.warn(`ERROR NOT FOUND cFLengthIndex FROM CONSTR ${constructionId} TO FACTORY ${factoryId}`)
    }
    // windowOffset = timeWindowCurrent[0] - fCLengthIndex[doc.factoryId][doc.constructionId]

    windowOffset = timeWindowCurrent[0] > (fCLengthIndex[doc.factoryId][doc.constructionId] + dailyLength)
      ? timeWindowCurrent[0] - (fCLengthIndex[doc.factoryId][doc.constructionId] + dailyLength)
      : 0

    // console.log(`LENGTH_RETURN`, constructionId, factoryId, `=`, lengthReturn)

    if (length === null) {
      length = fCLengthIndex[factoryId][doc.constructionId] + lengthReturn + windowOffset

      console.log(`length = fCLengthIndex[factoryId][doc.constructionId] + lengthReturn + windowOffset`)
      console.log(`length`, length, `fCLengthIndex[factoryId][doc.constructionId]`, fCLengthIndex[factoryId][doc.constructionId],
        `lengthReturn`, lengthReturn, `windowOffset`, windowOffset)

      windowOffsetCurrent = windowOffset
      lengthReturnCurrent = lengthReturn
      transportId = id

      if (!length) {
        console.warn(`ERROR CANNOT ACCESS LENGTH FOR FACTORY`, factoryId, `CONSTRUCTION`, constructionId)
      }
    } else {
      if (length > fCLengthIndex[factoryId][doc.constructionId] + lengthReturn + windowOffset) {
        transportId = id
        windowOffsetCurrent = windowOffset
        lengthReturnCurrent = lengthReturn
        length = fCLengthIndex[factoryId][doc.constructionId] + lengthReturn + windowOffset

        console.log(`length`, length, `fCLengthIndex[factoryId][doc.constructionId]`, fCLengthIndex[factoryId][doc.constructionId],
          `lengthReturn`, lengthReturn, `windowOffset`, windowOffset)

      }
    }
  }

  if (length === null) {
    return -1
  }

  const transportTaskId = transportId
  const transportTaskDoc = transportTask[transportId]

  if (transportDoc.dailyLength + length > LENGTH_MAX) {
    return -2
  }

  const transportDocNext = {
    ...transportDoc,
    dailyLength: dailyLength + length,
    runQuantity: runQuantity + 1,
    transportTaskMap: [
      ...transportDoc.transportTaskMap,
      {
        transportTaskId,
        length,
        lengthReturn: lengthReturnCurrent,
        windowOffset: windowOffsetCurrent,
      }
    ],
  }

  return {
    constructionId: transportTaskDoc.constructionId,
    length,
    lengthReturn,
    transportDoc: transportDocNext,
    transportTaskId,
  }
}

const process = async (payload, options) => {
  const { transportTask } = payload
  const { fCLength } = payload
  const { fCLengthIndex } = payload
  const { cFLengthIndex } = payload
  const { previousTransport } = payload

  const timeWindowMap = {
    201: [2, 4],
    203: [7, 12],
    204: [3, 6],
    205: [6, 11],
    208: [7, 9],

    // 201: [0, 12],
    // 202: [3, 12],
    // 203: [3, 4],
    // 204: [5, 12],
    // 205: [0, 12],
    // 206: [0, 12],
    // 207: [0, 12],
    // 208: [0, 12],
    // 209: [0, 12],
    // 210: [0, 12],
    // 211: [0, 12],
    // 212: [0, 12],
    // 213: [0, 12],
    // 214: [10, 12],
    // 215: [0, 12],
    // 216: [0, 12],
    // 217: [0, 12],
    // 218: [0, 12],
    // 219: [0, 12],
    // 220: [0, 12],
    // 221: [0, 12],
    // 222: [0, 12],
    // 223: [0, 12],
    // 224: [0, 12],


    // 0: [4, 6],
    // 1: [6, 7],
    // 2: [2, 7],
    // 3: [2, 6],
  }

  const transport = {
    ...previousTransport,
  }

  let firstTask = null
  let transportDoc = null
  let constructionId = null

  const log = []

  let iteration = 0
  while (iteration < 500) {
    if (!firstTask) {
      firstTask = getShortTask({
        transportTask,
        fCLengthIndex,
        timeWindowMap,
      })

      transportDoc = firstTask.transportDoc

      const { transportTaskId } = firstTask
      const { transportType } = transportDoc

      const transportTaskDoc = transportTask[firstTask.transportTaskId]

      transportTask[transportTaskId].status = transportStatusType.DONE
      transport[transportDoc.id] = transportDoc
      constructionId = firstTask.constructionId

      log.push(`Обработан маршрут длиной ${firstTask.length} добавлен новый автомобиль`)

      console.log(`NEW TRANSPORT`, transportDoc.id, `TASK`, transportTaskId, `LENGTH`, firstTask.length)
      console.log(`FROM`, transportTaskDoc.factoryId, `TO`, transportTaskDoc.constructionId,
        `LENGTH`, fCLengthIndex[transportTaskDoc.factoryId][transportTaskDoc.constructionId])
      console.log(`CONSTRUCTION_ID`, constructionId)
    } else {
      const nextTask = getShortTaskBasedOnConstructionId({
        transportTask,
        fCLengthIndex,
        cFLengthIndex,
        constructionId,
        transportDoc,
        timeWindowMap,
      })

      if (nextTask === -1) {
        console.log(`NO TYPE`)

        firstTask = null
        iteration++
        continue
      }

      if (nextTask === -2) {
        console.log(`DAILY LENGTH EXCEED`)

        firstTask = null
        iteration++
        continue
      }

      const transportTaskDoc = transportTask[nextTask.transportTaskId]

      console.log(`FOUND NEW RUN FOR TRANSPORT`, nextTask.transportDoc.id, `TASK`, nextTask.transportTaskId, `LENGTH`, nextTask.length)
      console.log(`RETURN FROM`, constructionId, `LENGTH RETURN`, nextTask.lengthReturn)
      console.log(`FROM`, transportTaskDoc.factoryId, `TO`, transportTaskDoc.constructionId,
        `LENGTH`, fCLengthIndex[transportTaskDoc.factoryId][transportTaskDoc.constructionId])

      transportDoc = nextTask.transportDoc

      transportTask[nextTask.transportTaskId].status = transportStatusType.DONE
      transport[nextTask.transportDoc.id] = nextTask.transportDoc
    }

    let b = false
    for (let id in transportTask) {
      if (transportTask[id].status !== transportStatusType.DONE) {
        b = true
        break
      }
    }
    if (!b) break

    iteration++
  }

  console.log(`ITERATION`, iteration)
  console.log(`TRANSPORT COUNT`, Object.keys(transport).length)
  console.log(`TRANSPORT`, transport)
  console.log(`TRANSPORT_TASK`, transportTask)

  return {
    iteration,
    transport,
  }
}

const enhance = compose(
  withStateHandlers(() => ({
    date: ``,

    positionFrom: null,
    positionTo: null,

    fromFactory: {
      data: {},
      order: [],
    },

    fromConstruction: {
      data: {},
      order: [],
    },

    fromTransportTask: {
      data: {},
      order: [],
    },

    routeHide: false,

    iteration: -1,

    isShowConstruction: true,
    isShowFactory: true,

    transport: {},

    center: positionMap.Moscow,
    map: null,
    ymaps: null,
    zoom: 9,
  }), {
    dateSet: () => (date) => ({ date }),

    centerSet: () => (center) => ({ center }),
    fromConstructionSet: () => (data, order) => ({ fromConstruction: { data, order }}),
    fromFactorySet: () => (data, order) => ({ fromFactory: { data, order }}),
    fromTransportTaskSet: () => (data, order) => ({ fromTransportTask: { data, order }}),

    isShowConstructionSet: () => (isShowConstruction) => ({ isShowConstruction }),
    isShowFactorySet: () => (isShowFactory) => ({ isShowFactory }),

    iterationSet: () => (iteration) => ({ iteration }),

    positionFromSet: () => (positionFrom) => ({ positionFrom }),
    positionToSet: () => (positionTo) => ({ positionTo }),

    routeHideSet: () => (routeHide) => ({ routeHide }),

    transportSet: () => (transport) => ({ transport }),

    markerSet: () => (marker) => ({ marker }),
    mapSet: () => (map) => ({ map }),
    ymapsSet: () => (ymaps) => ({ ymaps }),
    zoomSet: () => (zoom) => ({ zoom }),
  }),
  withPropsOnChange(
    [`routeHide`],
    ({ routeHideSet }) => {
      setTimeout(() => {
        routeHideSet(false)
      }, 500)
    }
  ),
  withPropsOnChange(
    [`ymaps`, `map`],
    ({ ymaps, map }) => {
      if (ymaps && map) {

      //   ymaps.route([
      //     'Королев',
      //     { type: 'viaPoint', point: 'Мытищи' },
      //     'Химки',
      //     { type: 'wayPoint', point: [55.811511, 37.312518] }
      //   ], {
      //     mapStateAutoApply: true
      //   }).then((route) => {
      //     try {
      //       route.getPaths().options.set({
      //         // в балуне выводим только информацию о времени движения с учетом пробок
      //         balloonContentBodyLayout: ymaps.templateLayoutFactory.createClass('$[properties.humanJamsTime]'),
      //         // можно выставить настройки графики маршруту
      //         strokeColor: '0000ffff',
      //         opacity: 0.9
      //       });

      //       map.geoObjects.add(route)
      //     } catch (err) {
      //       console.log(`ERROR`, err)
      //     }
      //   })        
      }
    }
  ),
  withHandlers({
    moveToLebanon: ({ centerSet, zoomSet }) => () => {
      centerSet(positionMap.Lebanon)
      zoomSet(14)
    },
    onMapClick: ({ markerSet }) => ({ latLng }) => {
      markerSet(latLng)
    },
    onLoad: () => (payload) => {
    },
    queryFactory: ({
      fromConstructionSet,
      fromFactorySet,
    }) => async () => {
      const list = await factoryQuery()
      const data = {}
      const constructionData = {}

      for (let doc of list) {
        const [id, name, description, lon, lat] = doc
        if (id < 200) {
          data[id] = { id, name, description, lat, lon }
        } else {
          constructionData[id] = { id, name, description, lat, lon }
        }
      }

      const order = Object.keys(data)
      const constructionOrder = Object.keys(constructionData)

      fromConstructionSet(constructionData, constructionOrder)
      fromFactorySet(data, order)
    },
    queryTransportTask: ({ fromTransportTaskSet }) => async () => {
      const data = await transportTaskQuery()
      const order = Object.keys(data)

      fromTransportTaskSet(data, order)
    },
    onApiAvaliable: ({ map, ymapsSet }) => (ymaps) => {
      ymapsSet(ymaps)
    },
  }),
  withHandlers(() => {
    const timerList = []

    return {
      onClick: ({ iterationSet, transportSet }) => async () => {
        const fCLength = await factoryContrstructionLengthQuery()
        const transportTask = await transportTaskQuery()

        const fCLengthIndex = Object.keys(fCLength).reduce((acc, id) => {
          const { factoryId, constructionId, length } = fCLength[id]
          acc[factoryId] = {
            ...(acc[factoryId] || {}),
            [constructionId]: length,
          }
          return acc
        }, {})

        const cFLengthIndex = Object.keys(fCLength).reduce((acc, id) => {
          const { factoryId, constructionId, length } = fCLength[id]
          acc[constructionId] = {
            ...(acc[constructionId] || {}),
            [factoryId]: length,
          }
          return acc
        }, {})

        const response = await process({
          transportTask,
          fCLength,
          fCLengthIndex,
          cFLengthIndex,
          previousTransport: {},
        })

        const { transport, iteration } = response

        iterationSet(iteration)
        transportSet(transport)
        console.log(`REFRESH`, response)
      },
      mount: ({
        queryFactory,
        queryTransportTask,  
      }) => () => {
        queryFactory()
        queryTransportTask()
        // timerList.push(setTimeout(moveToLebanon, 1000))
        
      },
      unmount: () => () => {
        for (let timer of timerList) {
          clearTimeout(timer)
        }
      }
    }
  }),
  lifecycle({
    componentDidMount() {
      this.props.mount()
    },
    componentWillUnmount() {
      this.props.unmount()
    }
  })
)

const Title = styled(Grid)`
  background-color: rgba(0, 0, 0, 0);
  color: white;

  padding: 10px;
`

const TransportTaskList = ({
  fromConstruction,
  fromFactory,
  positionFromSet,
  positionToSet,
  routeHideSet,
  data,
  order,
}) => {
  return (
    <Table celled striped>
      <Table.Body>
        {order.map((id) => {
          const factoryDoc = fromFactory.data[data[id].factoryId] || {}
          const constructionDoc = fromConstruction.data[data[id].constructionId] || {}
          const transportName = transportMap[data[id].transportType]

          return (
            <Table.Row key={id} 
              style={{ cursor: `pointer` }}
              onClick={() => {
                positionFromSet([factoryDoc.lat, factoryDoc.lon])
                positionToSet([constructionDoc.lat, constructionDoc.lon])
                routeHideSet(true)
              }}
            >
              <Table.Cell collapsing>
                <Icon name='folder' /> {data[id].id}
              </Table.Cell>
              <Table.Cell>{factoryDoc.name}</Table.Cell>
              <Table.Cell>{constructionDoc.name}</Table.Cell>
              <Table.Cell>{transportName}</Table.Cell>
            </Table.Row>
          )
        })}
      </Table.Body>
    </Table>
  )
}

const TransportDetail = ({
  doc,
  index,
  fromConstruction,
  fromTransportTask,
  fromFactory,
}) => {
  const { transportType } = doc
  const { dailyLength } = doc
  const { dailyOffset } = doc
  const { runQuantity } = doc
  const { transportTaskMap } = doc

  const startDay = moment({ hour: 8 })

  const startTime = startDay.add({ hour: dailyOffset })

  return (
    <React.Fragment>
      <Table celled striped>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell colSpan='4'>АВТОМОБИЛЬ №{index + 1} (ТИП №{transportType} - {transportMap[transportType]}) - РЕЙСОВ {runQuantity}</Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          <Table.Row>
            <Table.Cell>Рабочий день</Table.Cell>
            <Table.Cell>{dailyLength} (ч)</Table.Cell>
            <Table.Cell>Начало смены</Table.Cell>
            <Table.Cell>{startTime.format(`HH:mm`)}</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>

      <Table celled striped>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>ДО ПРОИЗВОДСТВА</Table.HeaderCell>
            <Table.HeaderCell>ОТКУДА</Table.HeaderCell>
            <Table.HeaderCell>КУДА</Table.HeaderCell>
            <Table.HeaderCell>ПРОСТОЙ</Table.HeaderCell>
            <Table.HeaderCell>ОБЩЕЕ ВРЕМЯ</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        
        <Table.Body>
          {Object.keys(transportTaskMap).map((id, index) => {
            const taskDoc = transportTaskMap[id]
            const { transportTaskId } = taskDoc

            const transportTaskDoc = fromTransportTask.data[transportTaskId]
            const { constructionId, factoryId } = transportTaskDoc

            const factoryDoc = fromFactory.data[factoryId] || {}
            const constructionDoc = fromConstruction.data[constructionId] || {}

            const startFrom = !taskDoc.lengthReturn ?
              `НАЧАЛО МАРШРУТА` : `${taskDoc.lengthReturn} (ч)`

            //console.log(`transportTaskDoc`, transportTaskDoc)

            return (
              <Table.Row style={{ cursor: `pointer` }}>
                <Table.Cell>{startFrom}</Table.Cell>
                <Table.Cell>{factoryDoc.name}</Table.Cell>
                <Table.Cell>{constructionDoc.name}</Table.Cell>
                <Table.Cell>{taskDoc.windowOffset} (ч)</Table.Cell>
                <Table.Cell>{taskDoc.length} (ч)</Table.Cell>
              </Table.Row>
            )
          })}
        </Table.Body>
      </Table>
    </React.Fragment>
  )
}

const App = enhance((props) => {
  const {
    date, dateSet,

    fromConstruction,
    fromFactory,
    fromTransportTask,

    center,

    isShowConstruction, isShowConstructionSet,
    isShowFactory, isShowFactorySet,

    iteration,

    positionFrom, positionFromSet,
    positionTo, positionToSet,

    routeHide, routeHideSet,

    transport,

    marker,
    map, mapSet,
    ymaps,
    zoom,

    onApiAvaliable,
    onClick,
    onMapClick,
    onLoad,
  } = props

  // console.log(`POSITION_FROM`, positionFrom)
  // console.log(`POSITION_To`, positionTo)

  return (
    <Grid container justify='center'>
      <Title item xs={12} sm={6} style={{ fontSize: `120%`, fontWeight: 'bold' }}>
        <img src='https://i.imgur.com/HVk4Z4A.png' width={45} />
      </Title>
      <Title item xs={12} sm={2}>
        <Button
          positive
          onClick={onClick}
        >
          РАССЧИТАТЬ
        </Button>
      </Title>
      <Title item xs={12} sm={4} style={{ textAlign: `right` }}>
        <DateInput
          closable
          closeOnMouseLeave={false}
          value={date}
          onChange={(e, { value }) => dateSet(value)}
        />
      </Title>
      <Grid item xs={12} style={{ height: 400 }}>
        <YMaps
          onApiAvaliable={onApiAvaliable}
        >
          <Map 
            instanceRef={mapSet}
            state={{ center, zoom }}
            width='100vw'
            height={400}

            onLoad={onLoad}
          >
            {ymaps && map && isShowFactory && fromFactory.order.map((id) => {
              const { lat, lon } = fromFactory.data[id]
              const position = [lat, lon]

              return ymaps && map && (
                <Marker
                  key={id}
                  ymaps={ymaps}
                  map={map}
                  iconImageHref='https://i.imgur.com/VXSDX1b.png'
                  iconColor='#ff0000'
                  position={position}
                />
              )
            })}
            {ymaps && map && isShowConstruction && fromConstruction.order.map((id) => {
              const { lat, lon } = fromConstruction.data[id]
              const position = [lat, lon]

              return ymaps && map && (
                <Marker
                  key={id}
                  ymaps={ymaps}
                  map={map}
                  iconColor='#0000ff'
                  position={position}
                />
              )
            })}
            {positionFrom && positionTo && ymaps && map && !routeHide ? (
              <Route
                ymaps={ymaps}
                map={map}              
                positionFrom={positionFrom}
                positionTo={positionTo}
              />
            ) : null}
          </Map>
        </YMaps>      
      </Grid>
      <Grid item xs={12}>
        <div style={{ padding: 5 }}>
          <div style={{ display: `inline-block`, padding: 5, fontWeight: `bold` }}>ФИЛЬТР</div>
          <Button
            primary={isShowFactory}
            onClick={() => isShowFactorySet(!isShowFactory)}
          >
            ПРОИЗВОДСТВА
          </Button>
          <Button
            primary={isShowConstruction}
            onClick={() => isShowConstructionSet(!isShowConstruction)}
          >
            ПЛОЩАДКИ
          </Button>
        </div>
      </Grid>
      <Grid item xs={12}>
        <Tab menu={{ pointing: true }} panes={[
          { menuItem: 'РЕЙС-КОМПЛЕКТЫ', render: () => (
            <Tab.Pane>
              <TransportTaskList
                fromConstruction={fromConstruction}
                fromFactory={fromFactory}
                data={fromTransportTask.data}
                order={fromTransportTask.order}
                positionFromSet={positionFromSet}
                positionToSet={positionToSet}
                routeHideSet={routeHideSet}
              />   
            </Tab.Pane>
          )},
          { menuItem: `МАРШРУТЫ (СЕГОДНЯ)`, render: () => (
            <Tab.Pane>
              {Object.keys(transport).map((id, index) => {
                const doc = transport[id]

                return (
                  <TransportDetail
                    key={id}
                    index={index}
                    fromTransportTask={fromTransportTask}
                    fromFactory={fromFactory}
                    fromConstruction={fromConstruction}
                    doc={doc}
                  />
                )
              })}
            </Tab.Pane>
          )},
          { menuItem: `ЖУРНАЛ${ iteration != -1 ? ` - ${iteration}` : `` }`, render: () => <Tab.Pane>Tab 3 Content</Tab.Pane> },          
        ]} />
      </Grid>
    </Grid>
  )
})

const rootElement = document.getElementById('root')
ReactDOM.render(<App />, rootElement)
