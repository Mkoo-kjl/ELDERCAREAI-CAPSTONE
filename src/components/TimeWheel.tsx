import {forwardRef, useEffect, useImperativeHandle, useRef} from 'react';
import {Pressable, ScrollView, StyleSheet, View, useColorScheme} from 'react-native';
import {AppText as Text} from './AppText';
import {getTheme, palette} from '@/src/theme/colors';
import {fontFamily} from '@/src/theme/typography';

const ROW = 44;
export const timeWheelRowHeight = ROW;
export type TimeWheelHandle = {flush:()=>void};

/** Five visible rows with the chosen value snapped into the middle row. */
export const TimeWheel = forwardRef<TimeWheelHandle, {
  label:string; options:string[]; selected:number; onSelect:(index:number)=>void;
}>(function TimeWheel({label, options, selected, onSelect}, ref) {
  const theme = getTheme(useColorScheme() === 'dark');
  const scroll = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offset = useRef(selected * ROW);
  const latest = useRef({selected, onSelect});
  latest.current = {selected, onSelect};
  const clearTimer = () => {if (timer.current) clearTimeout(timer.current); timer.current = null;};
  useEffect(() => {
    offset.current = selected * ROW;
    scroll.current?.scrollTo({y:selected * ROW, animated:false});
  }, [selected]);
  useEffect(() => () => {if (timer.current) clearTimeout(timer.current);}, []);
  const commit = (y:number) => {
    clearTimer();
    const index = Math.max(0, Math.min(options.length - 1, Math.round(y / ROW)));
    offset.current = index * ROW;
    scroll.current?.scrollTo({y:index * ROW, animated:false});
    if (index !== latest.current.selected) latest.current.onSelect(index);
  };
  useImperativeHandle(ref, () => ({flush:() => commit(offset.current)}));
  return <View style={styles.column}>
    <Text style={[styles.label, {color:theme.subtitle}]}>{label}</Text>
    <View style={styles.viewport}>
      <View pointerEvents="none" style={[styles.selection, {backgroundColor:palette.aquaSurface, borderColor:theme.border}]}/>
      <ScrollView ref={scroll} testID={`${label.toLowerCase()}-wheel`} nestedScrollEnabled
        accessibilityRole="adjustable" accessibilityLabel={label}
        accessibilityValue={{min:0, max:options.length - 1, now:selected, text:options[selected]}}
        accessibilityActions={[{name:'increment', label:`Next ${label.toLowerCase()}`}, {name:'decrement', label:`Previous ${label.toLowerCase()}`} ]}
        onAccessibilityAction={({nativeEvent}) => {
          if (nativeEvent.actionName === 'increment') commit((selected + 1) * ROW);
          if (nativeEvent.actionName === 'decrement') commit((selected - 1) * ROW);
        }}
        showsVerticalScrollIndicator={false} snapToInterval={ROW} decelerationRate="fast" bounces={false}
        scrollEventThrottle={16} contentContainerStyle={styles.rows}
        onLayout={() => scroll.current?.scrollTo({y:latest.current.selected * ROW, animated:false})}
        onScroll={({nativeEvent}) => {
          offset.current = nativeEvent.contentOffset.y;
          clearTimer();
          // Also handles slow drags and mouse-wheel scrolling without momentum events.
          timer.current = setTimeout(() => commit(offset.current), 160);
        }}
        onMomentumScrollBegin={clearTimer}
        onMomentumScrollEnd={({nativeEvent}) => commit(nativeEvent.contentOffset.y)}>
        {options.map((text, index) => <Pressable key={text} accessibilityRole="button"
          accessibilityLabel={`${label} ${text}`} accessibilityState={{selected:index === selected}}
          onPress={() => commit(index * ROW)} style={styles.row}>
          <Text maxFontSizeMultiplier={1.5} style={[styles.value, {color:index === selected ? palette.primaryDark : theme.subtitle, opacity:index === selected ? 1 : Math.abs(index - selected) === 1 ? 0.65 : 0.4}]}>{text}</Text>
        </Pressable>)}
      </ScrollView>
    </View>
  </View>;
});

const styles = StyleSheet.create({
  column:{flex:1, minWidth:0}, label:{fontFamily:fontFamily.medium, fontSize:12, textAlign:'center', marginBottom:10},
  viewport:{height:ROW * 5, overflow:'hidden'}, rows:{paddingVertical:ROW * 2},
  selection:{position:'absolute', top:ROW * 2, left:0, right:0, height:ROW, borderTopWidth:1, borderBottomWidth:1, borderRadius:8},
  row:{height:ROW, justifyContent:'center', alignItems:'center'}, value:{fontSize:22, fontFamily:fontFamily.semiBold, fontVariant:['tabular-nums']},
});
