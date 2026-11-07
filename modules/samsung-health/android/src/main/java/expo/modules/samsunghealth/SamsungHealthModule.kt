package expo.modules.samsunghealth

import com.samsung.android.sdk.health.data.HealthDataService
import com.samsung.android.sdk.health.data.data.HealthDataPoint
import com.samsung.android.sdk.health.data.device.DeviceGroup
import com.samsung.android.sdk.health.data.permission.AccessType
import com.samsung.android.sdk.health.data.permission.Permission
import com.samsung.android.sdk.health.data.request.*
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.Duration

class SamsungHealthModule : Module() {
  private fun store()=HealthDataService.getStore(appContext.reactContext ?: error("Application context unavailable"))
  private val sleepPermission get()=Permission.of(DataTypes.SLEEP,AccessType.READ)
  private val oxygenPermission get()=Permission.of(DataTypes.BLOOD_OXYGEN,AccessType.READ)
  override fun definition()=ModuleDefinition {
    Name("SamsungHealth")
    AsyncFunction("getAccess") Coroutine { ->
      val granted=store().getGrantedPermissions(setOf(sleepPermission,oxygenPermission))
      mapOf("sleep" to granted.contains(sleepPermission),"oxygen" to granted.contains(oxygenPermission))
    }
    AsyncFunction("requestAccess") Coroutine { ->
      val activity=appContext.currentActivity ?: error("Open the app to connect Samsung Health")
      val granted=withContext(Dispatchers.Main){store().requestPermissions(setOf(sleepPermission,oxygenPermission),activity)}
      mapOf("sleep" to granted.contains(sleepPermission),"oxygen" to granted.contains(oxygenPermission))
    }
    AsyncFunction("sources") Coroutine { ->
      store().getDeviceManager().getDevices(DeviceGroup.WATCH).map { mapOf("id" to it.id,"name" to it.name.orEmpty(),"model" to it.model.orEmpty(),"manufacturer" to it.manufacturer.orEmpty()) }
    }
    AsyncFunction("readPage") Coroutine { kind:String,sourceId:String,from:String,until:String,cursor:String? ->
      val health=store();val permission=if(kind=="sleep")sleepPermission else oxygenPermission
      check(health.getGrantedPermissions(setOf(permission)).contains(permission)){"Samsung Health read permission is not granted"}
      val builder=if(kind=="sleep")DataTypes.SLEEP.readDataRequestBuilder else DataTypes.BLOOD_OXYGEN.readDataRequestBuilder
      builder.setPageSize(100).setOrdering(Ordering.ASC).setSourceFilter(ReadSourceFilter.fromDeviceType(DeviceGroup.WATCH))
        .setInstantTimeFilter(InstantTimeFilter.of(Instant.parse(from),Instant.parse(until)))
      if(!cursor.isNullOrBlank())builder.setPageToken(cursor)
      val result=health.readData(builder.build());val records=mutableListOf<Map<String,Any?>>()
      for(point in result.dataList){
        if(point.dataSource?.deviceId!=sourceId)continue
        if(kind=="sleep")sleep(point)?.let {records.add(it)} else records.addAll(oxygen(point))
      }
      mapOf("records" to records,"cursor" to result.pageToken)
    }
  }
  private fun sleep(point:HealthDataPoint):Map<String,Any?>? {
    val uid=point.uid ?: return null;val revision=point.updateTime ?: return null
    val duration=point.getValue(DataType.SleepType.DURATION) ?: return null
    val start=point.startTime ?: return null;val end=point.endTime ?: return null;val minutes=duration.toMillis()/60000.0
    if(minutes<=0 || minutes>1440 || end>Instant.now() || end<=start)return null
    return mapOf("metric" to "sleep_hours","value" to minutes/60.0,"measured_at" to end.toString(),
      "source_record_key" to "sleep:$uid","source_group_key" to "sleep:$uid","source_revision_at" to revision.toString(),
      "session_start_at" to start.toString(),"session_end_at" to end.toString(),"minutes_asleep" to minutes,
      "minutes_in_sleep_period" to Duration.between(start,end).toMillis()/60000.0)
  }
  private fun oxygen(point:HealthDataPoint):List<Map<String,Any?>> {
    val uid=point.uid ?: return emptyList();val revision=point.updateTime ?: return emptyList()
    val result=mutableListOf<Map<String,Any?>>()
    fun add(value:Float,at:Instant){
      if(!value.isFinite()||value<=0||value>100||at>Instant.now())return
      result.add(mapOf("metric" to "spo2_percent","value" to value.toDouble(),"measured_at" to at.toString(),
        "source_record_key" to "oxygen:$uid:${at.toEpochMilli()}","source_group_key" to "oxygen:$uid","source_revision_at" to revision.toString()))
    }
    val series=point.getValue(DataType.BloodOxygenType.SERIES_DATA)
    if(!series.isNullOrEmpty())for(entry in series)add(entry.oxygenSaturation,entry.startTime)
    else point.getValue(DataType.BloodOxygenType.OXYGEN_SATURATION)?.let {value->point.startTime?.let {add(value,it)}}
    return result
  }
}
